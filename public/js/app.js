/* ═══════════════════════════════════════════════════════
   APP.JS — Core frontend utility module
   ═══════════════════════════════════════════════════════ */

// ─── Preloader Management ────────────────────────────────
(function () {
    const preloaderHtml = `
        <div id="p360_preloader" class="preloader">
            <!-- Ambient glow orbs -->
            <div class="pl-orb pl-orb-a"></div>
            <div class="pl-orb pl-orb-b"></div>
            <div class="pl-orb pl-orb-c"></div>

            <div class="pl-body">
                <!-- Pulsing logo ring -->
                <div class="pl-ring" style="background: linear-gradient(135deg, var(--accent), #d4952d); border: none;">
                    <div style="font-size: 2.2rem; font-weight: 900; color: var(--dark-900); font-family: 'Outfit'; letter-spacing: -1px; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">B&S</div>
                </div>

                <!-- Brand -->
                <div class="pl-brand">
                    <div class="pl-brand-name">Book<em>&Sync</em></div>
                    <div class="pl-brand-tag">Yercaud Stays & Taxis</div>
                </div>

                <!-- Progress bar -->
                <div class="preloader-progress">
                    <div class="preloader-bar"></div>
                </div>

                <!-- Dot trio -->
                <div class="pl-dots">
                    <div class="pl-dot"></div>
                    <div class="pl-dot"></div>
                    <div class="pl-dot"></div>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('afterbegin', preloaderHtml);

    const hidePreloader = () => {
        const loader = document.getElementById('p360_preloader');
        if (loader) {
            setTimeout(() => {
                loader.classList.add('fade-out');
                setTimeout(() => loader.remove(), 750);
            }, 500);
        }
    };

    if (document.readyState === 'complete') {
        hidePreloader();
    } else {
        window.addEventListener('load', hidePreloader);
    }
})();

// Safe localStorage wrapper for iframe/sandboxed environments
const safeStorage = (function() {
    try {
        const testKey = '__storage_test__';
        window.localStorage.setItem(testKey, testKey);
        window.localStorage.removeItem(testKey);
        return window.localStorage;
    } catch (e) {
        const memoryStorage = {};
        return {
            getItem(key) { return memoryStorage[key] || null; },
            setItem(key, value) { memoryStorage[key] = String(value); },
            removeItem(key) { delete memoryStorage[key]; },
            clear() { for (const k in memoryStorage) delete memoryStorage[k]; }
        };
    }
})();

// ─── API Configuration ──────────────────────────────────
// Automatically detect if running as a web app or a hybrid mobile app (Cordova)
const API_BASE_URL = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
    ? window.location.origin
    : 'https://yercaud.bookandsync.com';
const API = `${API_BASE_URL}/api`;

// ─── Auth State ─────────────────────────────────────────
const Auth = {
    // Detect context based on URL or explicit role
    getContext: (role) => {
        if (role) return `yercaud_${role}`;
        const path = window.location.pathname;
        if (path.includes('admin') || path.includes('trip-manager')) return 'yercaud_admin';
        if (path.includes('restaurant') || path.includes('resort') || path.includes('vendor')) {
            return 'yercaud_vendor';
        }
        if (path.includes('delivery')) return 'yercaud_delivery';
        if (path.includes('driver')) return 'yercaud_driver';
        return 'yercaud_customer';
    },

    getToken(role) { return safeStorage.getItem(`${this.getContext(role)}_token`); },
    getUser(role) {
        try {
            const ctx = this.getContext(role);
            let user = JSON.parse(safeStorage.getItem(`${ctx}_user`));
            
            // Fallback: Search all possible role contexts if not found in primary
            if (!user) {
                const roles = ['admin', 'vendor', 'driver', 'delivery', 'customer'];
                for (const r of roles) {
                    const u = JSON.parse(safeStorage.getItem(`yercaud_${r}_user`));
                    if (u) {
                        // If we were looking for a specific role, only return if it matches OR if user is admin
                        if (role) {
                            if (u.role === role || u.role === 'admin') return u;
                        } else {
                            return u;
                        }
                    }
                }
            }
            return user;
        } catch { return null; }
    },
    isLoggedIn(role) { return !!this.getToken(role); },

    save(token, user) {
        const ctx = this.getContext(user.role);
        safeStorage.setItem(`${ctx}_token`, token);
        safeStorage.setItem(`${ctx}_user`, JSON.stringify(user));
    },

    logout(role) {
        const ctx = this.getContext(role);
        safeStorage.removeItem(`${ctx}_token`);
        safeStorage.removeItem(`${ctx}_user`);

        const path = window.location.pathname;
        if (path.includes('admin') || role === 'admin') window.location.href = 'admin-login';
        else if (path.includes('restaurant') || role === 'restaurant') window.location.href = 'login-restaurant';
        else if (path.includes('resort') || role === 'resort') window.location.href = 'login-resort';
        else if (path.includes('driver') || role === 'driver') window.location.href = 'login-driver';
        else if (path.includes('delivery') || role === 'delivery') window.location.href = 'login-delivery';
        else window.location.href = 'login';
    },

    headers(role) {
        const h = { 'Content-Type': 'application/json' };

        // 1. If no role provided, try to detect from current URL context
        if (!role) {
            const ctx = this.getContext();
            const roles = ['admin', 'driver', 'delivery', 'vendor', 'resort', 'restaurant', 'customer'];
            for (const r of roles) {
                if (ctx === `yercaud_${r}` && this.isLoggedIn(r)) {
                    role = r;
                    break;
                }
            }
        }

        // 2. Fallback: Search all roles if still not found
        if (!role) {
            const roles = ['admin', 'driver', 'delivery', 'vendor', 'resort', 'restaurant', 'customer'];
            for (const r of roles) {
                if (this.isLoggedIn(r)) {
                    role = r;
                    break;
                }
            }
        }

        const token = this.getToken(role);
        if (token) h['Authorization'] = `Bearer ${token}`;
        return h;
    },

    checkAccess(requiredRole) {
        const user = this.getUser(requiredRole);
        // Allow access if user exists AND (no role required OR role matches OR user is admin)
        const canAccess = requiredRole 
            ? (user && (user.role === requiredRole || user.role === 'admin')) 
            : !!user;

        if (!canAccess) {
            console.warn(`Access Denied: Redirecting following context ${requiredRole || 'any'}`);
            const path = window.location.pathname;

            // Context-aware redirects
            if (path.includes('admin')) window.location.href = 'admin-login';
            else if (path.includes('restaurant')) window.location.href = 'login-restaurant';
            else if (path.includes('resort') || requiredRole === 'resort') window.location.href = 'login-resort';
            else if (path.includes('driver')) window.location.href = 'login-driver';
            else if (path.includes('delivery')) window.location.href = 'login-delivery';
            else window.location.href = 'login';

            return false;
        }
        return true;
    }
};

// Client-side local mock database and routing to run 100% offline
const mockDB = {
    get(key, defaultVal = []) {
        const val = safeStorage.getItem('y360_mock_' + key);
        return val ? JSON.parse(val) : defaultVal;
    },
    set(key, val) {
        safeStorage.setItem('y360_mock_' + key, JSON.stringify(val));
    }
};

function initMockData() {
    if (!mockDB.get('initialized', false)) {
        // Mock Drivers
        mockDB.set('drivers', [
            { id: 1, name: "Karthi M", vehicle_model: "Maruti Suzuki Dzire", vehicle_number: "TN 30 AB 1234", rating: 4.8, total_trips: 154, is_available: true, lat: 11.7820, lng: 78.2120 },
            { id: 2, name: "Suresh Kumar", vehicle_model: "Toyota Innova Crysta", vehicle_number: "TN 30 XY 9876", rating: 4.9, total_trips: 320, is_available: true, lat: 11.7780, lng: 78.2080 },
            { id: 3, name: "Velu Pillai", vehicle_model: "Hyundai Aura", vehicle_number: "TN 30 C 5543", rating: 4.7, total_trips: 89, is_available: false, lat: 11.7850, lng: 78.2150 }
        ]);

        // Mock Restaurants & Food Menu
        mockDB.set('restaurants', [
            { id: 1, name: "Shevaroys Golden Lake Restaurant", cuisine: "South Indian, Chinese", rating: 4.5, delivery_time: "30 mins", image_url: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80" },
            { id: 2, name: "The Grange Resort Restaurant", cuisine: "Continental, North Indian", rating: 4.3, delivery_time: "40 mins", image_url: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=600&q=80" },
            { id: 3, name: "Lake View Pure Veg", cuisine: "South Indian Veg, Tandoori", rating: 4.6, delivery_time: "25 mins", image_url: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=600&q=80" }
        ]);

        mockDB.set('menu_items', [
            { id: 101, restaurantId: 1, item_name: "Special Masala Dosa", price: 120, image_url: "https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=300&q=80", is_veg: true, rating: 4.7, category: "Breakfast" },
            { id: 102, restaurantId: 1, item_name: "Paneer Butter Masala", price: 220, image_url: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=300&q=80", is_veg: true, rating: 4.5, category: "Main Course" },
            { id: 103, restaurantId: 1, item_name: "Chettinad Chicken Biryani", price: 280, image_url: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=300&q=80", is_veg: false, rating: 4.8, category: "Biryani" },
            { id: 201, restaurantId: 2, item_name: "Grange Club Sandwich", price: 180, image_url: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=300&q=80", is_veg: true, rating: 4.4, category: "Snacks" },
            { id: 202, restaurantId: 2, item_name: "Grilled Chicken Steak", price: 350, image_url: "https://images.unsplash.com/photo-1432139548535-c8b8a45b4477?auto=format&fit=crop&w=300&q=80", is_veg: false, rating: 4.6, category: "Main Course" },
            { id: 301, restaurantId: 3, item_name: "Idli Sambar (2 Pcs)", price: 60, image_url: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=300&q=80", is_veg: true, rating: 4.8, category: "Breakfast" },
            { id: 302, restaurantId: 3, item_name: "North Indian Thali", price: 250, image_url: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=300&q=80", is_veg: true, rating: 4.7, category: "Thali" }
        ]);

        mockDB.set('rooms', [
            {
                id: 201,
                resort_name: "Sterling Yercaud",
                business_name: "Sterling Yercaud",
                room_type: "Classic Garden Room",
                price: 4500,
                price_per_night: 4500,
                rating: 4.4,
                city: "Yercaud",
                image_url: "img/rooms/r1/1.jpeg",
                images: JSON.stringify(["img/rooms/r1/1.jpeg", "img/rooms/r1/2.jpeg", "img/rooms/r1/3.jpeg", "img/rooms/r1/4.jpeg", "img/rooms/r1/5.jpeg", "img/rooms/r1/6.jpeg", "img/rooms/r1/7.jpeg", "img/rooms/r1/8.jpeg"]),
                album: ["img/rooms/r1/1.jpeg", "img/rooms/r1/2.jpeg", "img/rooms/r1/3.jpeg", "img/rooms/r1/4.jpeg", "img/rooms/r1/5.jpeg", "img/rooms/r1/6.jpeg", "img/rooms/r1/7.jpeg", "img/rooms/r1/8.jpeg"],
                description: "Beautiful garden facing room with king size bed and private seating.",
                amenities: "Free Wi-Fi, Mini Bar, Mountain View, Breakfast"
            },
            {
                id: 202,
                resort_name: "Grange Resort",
                business_name: "Grange Resort",
                room_type: "Safari Wooden Cabin",
                price: 6000,
                price_per_night: 6000,
                rating: 4.6,
                city: "Yercaud",
                image_url: "img/rooms/r2/1.jpeg",
                images: JSON.stringify(["img/rooms/r2/1.jpeg", "img/rooms/r2/2.jpeg", "img/rooms/r2/3.jpeg", "img/rooms/r2/4.jpeg", "img/rooms/r2/5.jpeg", "img/rooms/r2/6.jpeg", "img/rooms/r2/7.jpeg"]),
                album: ["img/rooms/r2/1.jpeg", "img/rooms/r2/2.jpeg", "img/rooms/r2/3.jpeg", "img/rooms/r2/4.jpeg", "img/rooms/r2/5.jpeg", "img/rooms/r2/6.jpeg", "img/rooms/r2/7.jpeg"],
                description: "Rustic wooden cabin nestled in lush coffee plantations.",
                amenities: "Free Breakfast, Fireplace, Eco-friendly, Private Balcony"
            },
            {
                id: 203,
                resort_name: "Grand Palace Hotel",
                business_name: "Grand Palace Hotel",
                room_type: "Valley View Suite",
                price: 8500,
                price_per_night: 8500,
                rating: 4.8,
                city: "Yercaud",
                image_url: "img/rooms/r3/1.jpeg",
                images: JSON.stringify(["img/rooms/r3/1.jpeg", "img/rooms/r3/2.jpeg", "img/rooms/r3/3.jpeg", "img/rooms/r3/4.jpeg", "img/rooms/r3/5.jpeg", "img/rooms/r3/6.jpeg", "img/rooms/r3/7.jpeg"]),
                album: ["img/rooms/r3/1.jpeg", "img/rooms/r3/2.jpeg", "img/rooms/r3/3.jpeg", "img/rooms/r3/4.jpeg", "img/rooms/r3/5.jpeg", "img/rooms/r3/6.jpeg", "img/rooms/r3/7.jpeg"],
                description: "Luxurious suite offering breathtaking panoramic views of Shevaroy hills.",
                amenities: "Jacuzzi, Private Balcony, Valley View, Room Service, AC"
            },
            {
                id: 204,
                resort_name: "Great Trails Yercaud",
                business_name: "Great Trails Yercaud by GRT",
                room_type: "Luxury Sky Villa",
                price: 9500,
                price_per_night: 9500,
                rating: 4.7,
                city: "Yercaud",
                image_url: "img/rooms/r4/1.jpeg",
                images: JSON.stringify(["img/rooms/r4/1.jpeg", "img/rooms/r4/2.jpeg", "img/rooms/r4/3.jpeg", "img/rooms/r4/4.jpeg", "img/rooms/r4/5.jpeg", "img/rooms/r4/6.jpeg", "img/rooms/r4/7.jpeg"]),
                album: ["img/rooms/r4/1.jpeg", "img/rooms/r4/2.jpeg", "img/rooms/r4/3.jpeg", "img/rooms/r4/4.jpeg", "img/rooms/r4/5.jpeg", "img/rooms/r4/6.jpeg", "img/rooms/r4/7.jpeg"],
                description: "Suspended style villa offering an immersive mountain stay experience.",
                amenities: "Free Wi-Fi, Coffee Maker, Infinity Pool Access, Valet Parking"
            },
            {
                id: 205,
                resort_name: "Rock Perch Resort",
                business_name: "Rock Perch Resort",
                room_type: "Premium Mountain Suite",
                price: 7200,
                price_per_night: 7200,
                rating: 4.5,
                city: "Yercaud",
                image_url: "img/rooms/r5/1.jpeg",
                images: JSON.stringify(["img/rooms/r5/1.jpeg", "img/rooms/r5/2.jpeg", "img/rooms/r5/3.jpeg", "img/rooms/r5/4.jpeg", "img/rooms/r5/5.jpeg", "img/rooms/r5/6.jpeg", "img/rooms/r5/7.jpeg", "img/rooms/r5/8.jpeg"]),
                album: ["img/rooms/r5/1.jpeg", "img/rooms/r5/2.jpeg", "img/rooms/r5/3.jpeg", "img/rooms/r5/4.jpeg", "img/rooms/r5/5.jpeg", "img/rooms/r5/6.jpeg", "img/rooms/r5/7.jpeg", "img/rooms/r5/8.jpeg"],
                description: "Perched on the edge of the hill, offering spectacular sunset views.",
                amenities: "Wi-Fi, Mini Bar, Flat TV, Bath Tub, Fireplace"
            },
            {
                id: 206,
                resort_name: "Shevaroys Hotel",
                business_name: "Shevaroys Hotel",
                room_type: "Executive Family Cottage",
                price: 5500,
                price_per_night: 5500,
                rating: 4.3,
                city: "Yercaud",
                image_url: "img/rooms/r6/1.jpeg",
                images: JSON.stringify(["img/rooms/r6/1.jpeg", "img/rooms/r6/2.jpeg", "img/rooms/r6/3.jpeg", "img/rooms/r6/4.jpeg", "img/rooms/r6/5.jpeg", "img/rooms/r6/6.jpeg", "img/rooms/r6/7.jpeg", "img/rooms/r6/8.jpeg"]),
                album: ["img/rooms/r6/1.jpeg", "img/rooms/r6/2.jpeg", "img/rooms/r6/3.jpeg", "img/rooms/r6/4.jpeg", "img/rooms/r6/5.jpeg", "img/rooms/r6/6.jpeg", "img/rooms/r6/7.jpeg", "img/rooms/r6/8.jpeg"],
                description: "Spacious multi-bedroom cottage perfect for families and group getaways.",
                amenities: "Kitchenette, Free Wi-Fi, Garden Seating, Kids Play Area"
            }
        ]);

        mockDB.set('offers', [
            { id: 1, title: "Lake Ride Special", description: "Get 15% off on lake side cab rides.", code: "LAKE15" },
            { id: 2, title: "Valley Stay Discount", description: "Book resort stay and get free breakfast.", code: "STAYFREE" }
        ]);

        mockDB.set('bookings', []);
        mockDB.set('orders', []);
        mockDB.set('trips', []);
        mockDB.set('users', [
            { id: 1, name: "John Doe", email: "john@example.com", phone: "9876543210", password: "password", role: "customer" },
            { id: 2, name: "Pilot Partner", email: "pilot@example.com", phone: "9988776655", password: "password", role: "driver", vehicle_model: "Maruti Suzuki Dzire", vehicle_number: "TN 30 AB 1234" },
            { id: 3, name: "Gourmet Chef", email: "chef@example.com", phone: "9988776644", password: "password", role: "restaurant" }
        ]);
        mockDB.set('initialized', true);
    }
}

// Background simulation: Automatically update active ride status over time (placed -> accepted -> arrived -> in_progress -> completed)
function runRideSimulation() {
    const bookings = mockDB.get('bookings');
    let modified = false;
    const now = Date.now();

    bookings.forEach(b => {
        if (b.module_type === 'taxi' && b.payment_status !== 'paid') {
            const elapsed = now - (b.status_updated_at || b.created_at);

            if (b.booking_status === 'placed' && elapsed > 6000) {
                const drivers = mockDB.get('drivers');
                const driver = drivers.find(d => d.is_available) || drivers[0];
                b.booking_status = 'accepted';
                b.driver_id = driver.id;
                b.driver_name = driver.name;
                b.driver_phone = "9876543210";
                b.vehicle_model = driver.vehicle_model;
                b.vehicle_number = driver.vehicle_number;
                b.otp_end = "4321";
                b.status_updated_at = now;
                modified = true;
                console.log(`[Mock Sim] Ride #${b.id} accepted by driver ${driver.name}`);
            } else if (b.booking_status === 'accepted' && elapsed > 10000) {
                b.booking_status = 'arrived';
                b.status_updated_at = now;
                modified = true;
                console.log(`[Mock Sim] Ride #${b.id} arrived at pickup location`);
            } else if (b.booking_status === 'arrived' && elapsed > 10000) {
                b.booking_status = 'in_progress';
                b.status_updated_at = now;
                modified = true;
                console.log(`[Mock Sim] Ride #${b.id} started`);
            } else if (b.booking_status === 'in_progress' && elapsed > 15000) {
                b.booking_status = 'completed';
                b.payment_status = 'pending';
                b.status_updated_at = now;
                modified = true;
                console.log(`[Mock Sim] Ride #${b.id} finished, pending payment`);
            }
        }
    });

    if (modified) {
        mockDB.set('bookings', bookings);
    }
}

// Start simulation on load and run every 3 seconds
initMockData();
setInterval(runRideSimulation, 3000);

async function apiFetch(endpoint, options = {}) {
    console.log(`[MOCK API FETCH] ${options.method || 'GET'} ${endpoint}`);
    initMockData();

    let body = {};
    if (options.body) {
        if (typeof options.body === 'string') {
            try { body = JSON.parse(options.body); } catch(e) { body = options.body; }
        }
        else if (options.body instanceof FormData) {
            body = {};
            for (const [key, value] of options.body.entries()) {
                body[key] = value;
            }
        }
        else body = options.body;
    }

    const cleanUrl = endpoint.split('?')[0];
    const queryParams = new URLSearchParams(endpoint.split('?')[1] || '');

    return new Promise((resolve, reject) => {
        setTimeout(() => {
            try {
                if (cleanUrl === '/auth/login') {
                    const users = mockDB.get('users');
                    const u = users.find(x => x.email === body.email && x.password === body.password);
                    if (u) {
                        resolve({ success: true, token: 'mock_jwt_token', data: u });
                    } else {
                        const newUser = { id: Date.now(), name: body.email.split('@')[0], email: body.email, phone: "9876543210", password: body.password, role: body.role || 'customer' };
                        users.push(newUser);
                        mockDB.set('users', users);
                        resolve({ success: true, token: 'mock_jwt_token', data: newUser });
                    }
                    return;
                }

                if (cleanUrl === '/auth/register' || cleanUrl === '/auth/register-driver' || cleanUrl === '/auth/register-delivery') {
                    const users = mockDB.get('users');
                    const role = cleanUrl === '/auth/register-driver' ? 'driver' : (cleanUrl === '/auth/register-delivery' ? 'delivery' : 'customer');
                    const newUser = {
                        id: Date.now(),
                        name: body.name,
                        email: body.email,
                        phone: body.phone,
                        password: body.password || 'password',
                        role: role,
                        vehicle_model: body.vehicleModel || body.vehicle_model,
                        vehicle_number: body.vehicleNumber || body.vehicle_number
                    };
                    users.push(newUser);
                    mockDB.set('users', users);
                    resolve({ success: true, token: 'mock_jwt_token', data: newUser });
                    return;
                }

                if (cleanUrl === '/auth/send-otp') {
                    resolve({ success: true, message: 'OTP sent to ' + body.email });
                    return;
                }

                if (cleanUrl === '/auth/verify-otp') {
                    resolve({ success: true, token: 'mock_jwt_token', data: { id: 999, name: "OTP User", email: "otp@yercaud.com", phone: body.phone, role: "customer" } });
                    return;
                }

                if (cleanUrl === '/auth/profile') {
                    const user = Auth.getUser(options.role) || mockDB.get('users')[0];
                    resolve({ success: true, data: user });
                    return;
                }

                if (cleanUrl === '/auth/profile/update') {
                    resolve({ success: true, message: 'Profile updated' });
                    return;
                }

                if (cleanUrl === '/auth/dashboard-summary') {
                    const bookings = mockDB.get('bookings');
                    const orders = mockDB.get('orders');
                    const trips = mockDB.get('trips');
                    resolve({
                        success: true,
                        data: { bookings, orders, trips }
                    });
                    return;
                }

                if (cleanUrl.match(/^\/auth\/bookings\/\d+\/cancel$/)) {
                    const parts = cleanUrl.split('/');
                    const id = parseInt(parts[3]);
                    const bookings = mockDB.get('bookings');
                    const b = bookings.find(x => x.id === id);
                    if (b) {
                        b.booking_status = 'cancelled';
                        mockDB.set('bookings', bookings);
                    }
                    resolve({ success: true, message: 'Booking cancelled' });
                    return;
                }

                if (cleanUrl === '/taxi/drivers') {
                    resolve({ success: true, data: mockDB.get('drivers') });
                    return;
                }

                if (cleanUrl === '/taxi/book') {
                    const bookings = mockDB.get('bookings');
                    const newBooking = {
                        id: bookings.length + 1,
                        module_type: 'taxi',
                        customer_name: body.customerName,
                        customer_phone: body.customerPhone,
                        passengers: body.passengers,
                        service_category: body.serviceCategory,
                        vehicle_type: body.vehicleType,
                        pickup_location: body.pickupLocation,
                        dropoff_location: body.dropoffLocation,
                        pickup_lat: body.pickupLat,
                        pickup_lng: body.pickupLng,
                        dropoff_lat: body.dropoffLat,
                        dropoff_lng: body.dropoffLng,
                        total_amount: body.totalAmount,
                        booking_status: 'placed',
                        payment_status: 'pending',
                        created_at: Date.now()
                    };
                    bookings.push(newBooking);
                    mockDB.set('bookings', bookings);
                    resolve({ success: true, message: 'Ride booked successfully', bookingId: newBooking.id });
                    return;
                }

                if (cleanUrl === '/taxi/pending') {
                    const bookings = mockDB.get('bookings');
                    resolve({ success: true, data: bookings.filter(b => b.module_type === 'taxi' && b.booking_status === 'placed') });
                    return;
                }

                if (cleanUrl === '/taxi/my-rides') {
                    const bookings = mockDB.get('bookings');
                    resolve({ success: true, data: bookings.filter(b => b.module_type === 'taxi') });
                    return;
                }

                if (cleanUrl.match(/^\/taxi\/accept\/\d+$/)) {
                    const parts = cleanUrl.split('/');
                    const id = parseInt(parts[3]);
                    const bookings = mockDB.get('bookings');
                    const b = bookings.find(x => x.id === id);
                    if (b) {
                        b.booking_status = 'accepted';
                        b.status_updated_at = Date.now();
                        mockDB.set('bookings', bookings);
                    }
                    resolve({ success: true, message: 'Ride accepted' });
                    return;
                }

                if (cleanUrl.match(/^\/taxi\/complete\/\d+$/)) {
                    const parts = cleanUrl.split('/');
                    const id = parseInt(parts[3]);
                    const bookings = mockDB.get('bookings');
                    const b = bookings.find(x => x.id === id);
                    if (b) {
                        b.booking_status = body.status || 'completed';
                        b.status_updated_at = Date.now();
                        mockDB.set('bookings', bookings);
                    }
                    resolve({ success: true, message: 'Ride status updated' });
                    return;
                }

                if (cleanUrl === '/rooms') {
                    resolve({ success: true, data: mockDB.get('rooms') });
                    return;
                }

                if (cleanUrl.match(/^\/rooms\/\d+$/)) {
                    const parts = cleanUrl.split('/');
                    const id = parseInt(parts[2]);
                    const rooms = mockDB.get('rooms');
                    const r = rooms.find(x => x.id === id);
                    resolve({ success: true, data: r || rooms[0] });
                    return;
                }

                if (cleanUrl === '/rooms/book') {
                    const bookings = mockDB.get('bookings');
                    const newBooking = {
                        id: bookings.length + 1,
                        module_type: 'room',
                        item_id: body.roomId,
                        check_in_date: body.checkInDate,
                        check_out_date: body.checkOutDate,
                        guests: body.guests,
                        total_amount: body.totalAmount,
                        booking_status: 'placed',
                        payment_status: 'paid',
                        created_at: Date.now()
                    };
                    bookings.push(newBooking);
                    mockDB.set('bookings', bookings);
                    resolve({ success: true, message: 'Room booked successfully', bookingId: newBooking.id });
                    return;
                }

                if (cleanUrl === '/resort/dashboard') {
                    const roomBookings = mockDB.get('bookings').filter(b => b.module_type === 'room');
                    const revenue = roomBookings.reduce((sum, b) => sum + parseFloat(b.total_amount || 0), 0);
                    resolve({
                        success: true,
                        data: {
                            totalRevenue: revenue,
                            totalBookings: roomBookings.length,
                            businessNames: ["Sterling Yercaud"]
                        }
                    });
                    return;
                }

                if (cleanUrl === '/resort/bookings') {
                    resolve({ success: true, data: { bookings: mockDB.get('bookings') } });
                    return;
                }

                if (cleanUrl.match(/^\/resort\/bookings\/\d+\/status$/) || cleanUrl.match(/^\/resort\/orders\/\d+\/status$/)) {
                    const parts = cleanUrl.split('/');
                    const id = parseInt(parts[3]);
                    const bookings = mockDB.get('bookings');
                    const b = bookings.find(x => x.id === id);
                    if (b) {
                        b.booking_status = body.status || 'confirmed';
                        if (body.roomNumber) {
                            b.notes = JSON.stringify({ assignedRoom: body.roomNumber });
                        }
                        b.status_updated_at = Date.now();
                        mockDB.set('bookings', bookings);
                    }
                    resolve({ success: true, message: 'Status updated' });
                    return;
                }

                if (cleanUrl === '/resort/rooms') {
                    if (options.method === 'POST') {
                        const rooms = mockDB.get('rooms');
                        const newRoom = {
                            id: Date.now(),
                            room_type: body.room_type,
                            price_per_night: parseFloat(body.price_per_night),
                            capacity: parseInt(body.capacity),
                            inventory: parseInt(body.inventory),
                            occupied_count: 0,
                            room_numbers: body.room_numbers,
                            amenities: body.amenities,
                            images: body.images || '[]',
                            description: body.description
                        };
                        rooms.push(newRoom);
                        mockDB.set('rooms', rooms);
                        resolve({ success: true, data: newRoom });
                    } else {
                        resolve({ success: true, data: mockDB.get('rooms') });
                    }
                    return;
                }

                if (cleanUrl.match(/^\/resort\/rooms\/\d+$/)) {
                    const parts = cleanUrl.split('/');
                    const id = parseInt(parts[3]);
                    const rooms = mockDB.get('rooms');
                    
                    if (options.method === 'PUT') {
                        const index = rooms.findIndex(x => x.id === id);
                        if (index !== -1) {
                            rooms[index] = {
                                ...rooms[index],
                                room_type: body.room_type,
                                price_per_night: parseFloat(body.price_per_night),
                                capacity: parseInt(body.capacity),
                                inventory: parseInt(body.inventory),
                                room_numbers: body.room_numbers,
                                amenities: body.amenities,
                                images: body.images || '[]',
                                description: body.description
                            };
                            mockDB.set('rooms', rooms);
                        }
                        resolve({ success: true, message: 'Room updated' });
                    } else if (options.method === 'DELETE') {
                        const filtered = rooms.filter(x => x.id !== id);
                        mockDB.set('rooms', filtered);
                        resolve({ success: true, message: 'Room deleted' });
                    }
                    return;
                }

                if (cleanUrl === '/food/restaurants') {
                    resolve({ success: true, data: mockDB.get('restaurants') });
                    return;
                }

                if (cleanUrl === '/food/resort/menu') {
                    resolve({ success: true, data: mockDB.get('menu_items') });
                    return;
                }

                if (cleanUrl === '/food/menu') {
                    const restId = parseInt(queryParams.get('restaurantId') || '1');
                    const items = mockDB.get('menu_items');
                    resolve({ success: true, data: items.filter(x => x.restaurantId === restId) });
                    return;
                }

                if (cleanUrl === '/food/menu/add') {
                    const items = mockDB.get('menu_items');
                    const newItem = {
                        id: Date.now(),
                        restaurantId: 1,
                        item_name: body.item_name,
                        price: parseFloat(body.price),
                        image_url: body.image_url || 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=300&q=80',
                        is_veg: body.is_veg === 1 || body.is_veg === true,
                        rating: 4.5,
                        category: body.category || 'Other',
                        description: body.description
                    };
                    items.push(newItem);
                    mockDB.set('menu_items', items);
                    resolve({ success: true, data: newItem });
                    return;
                }

                if (cleanUrl.match(/^\/food\/menu\/\d+$/)) {
                    const parts = cleanUrl.split('/');
                    const id = parseInt(parts[3]);
                    const items = mockDB.get('menu_items');

                    if (options.method === 'PUT') {
                        const index = items.findIndex(x => x.id === id);
                        if (index !== -1) {
                            items[index] = {
                                ...items[index],
                                item_name: body.item_name,
                                price: parseFloat(body.price),
                                image_url: body.image_url,
                                category: body.category,
                                description: body.description
                            };
                            mockDB.set('menu_items', items);
                        }
                        resolve({ success: true, message: 'Item updated' });
                    } else if (options.method === 'DELETE') {
                        const filtered = items.filter(x => x.id !== id);
                        mockDB.set('menu_items', filtered);
                        resolve({ success: true, message: 'Item deleted' });
                    }
                    return;
                }

                if (cleanUrl === '/food/order') {
                    const orders = mockDB.get('orders');
                    const newOrder = {
                        id: orders.length + 1,
                        restaurant_id: body.restaurantId,
                        total_amount: body.totalAmount,
                        status: 'placed',
                        payment_status: 'paid',
                        created_at: Date.now()
                    };
                    orders.push(newOrder);
                    mockDB.set('orders', orders);
                    resolve({ success: true, message: 'Order placed successfully', orderId: newOrder.id });
                    return;
                }

                if (cleanUrl === '/delivery/available') {
                    const orders = mockDB.get('orders');
                    resolve({ success: true, data: orders.filter(o => o.status === 'placed' || o.status === 'ready_for_pickup') });
                    return;
                }

                if (cleanUrl === '/delivery/my-orders') {
                    const orders = mockDB.get('orders');
                    resolve({ success: true, data: orders.filter(o => o.status === 'assigned' || o.status === 'out_for_delivery') });
                    return;
                }

                if (cleanUrl === '/delivery/history') {
                    const orders = mockDB.get('orders');
                    resolve({ success: true, data: orders.filter(o => o.status === 'delivered') });
                    return;
                }

                if (cleanUrl.match(/^\/delivery\/accept\/\d+$/)) {
                    const parts = cleanUrl.split('/');
                    const id = parseInt(parts[3]);
                    const orders = mockDB.get('orders');
                    const o = orders.find(x => x.id === id);
                    if (o) {
                        o.status = 'assigned';
                        mockDB.set('orders', orders);
                    }
                    resolve({ success: true, message: 'Order accepted' });
                    return;
                }

                if (cleanUrl.match(/^\/delivery\/status\/\d+$/)) {
                    const parts = cleanUrl.split('/');
                    const id = parseInt(parts[3]);
                    const orders = mockDB.get('orders');
                    const o = orders.find(x => x.id === id);
                    if (o) {
                        o.status = body.status;
                        o.updated_at = Date.now();
                        mockDB.set('orders', orders);
                    }
                    resolve({ success: true, message: 'Status updated' });
                    return;
                }

                if (cleanUrl === '/delivery/duty') {
                    resolve({ success: true, message: 'Duty status updated' });
                    return;
                }

                if (cleanUrl === '/delivery/location') {
                    resolve({ success: true, message: 'Location updated' });
                    return;
                }

                if (cleanUrl === '/upload/image' || cleanUrl === '/api/upload/image') {
                    resolve({ success: true, url: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&q=80' });
                    return;
                }

                if (cleanUrl === '/trip/plan') {
                    const plans = mockDB.get('trips');
                    const days = parseInt(body.days || '1');
                    const totalCost = days * (body.mode === 'suv' ? 8000 : 5000);
                    const newPlan = {
                        id: plans.length + 1,
                        title: `${days} Day Yercaud Custom Getaway`,
                        days: Array.from({ length: days }, (_, i) => ({
                            day: i + 1,
                            morning: `Explore Shevaroys forest & view point`,
                            afternoon: `Lunch at Lakeview, visit local plantation`,
                            evening: `Relaxing sunset walk & local market shopping`
                        })),
                        budgetBreakdown: {
                            stay: `₹${Math.round(totalCost * 0.5)}`,
                            food: `₹${Math.round(totalCost * 0.3)}`,
                            transport: `₹${Math.round(totalCost * 0.2)}`,
                            total: `₹${totalCost}`
                        }
                    };
                    plans.push(newPlan);
                    mockDB.set('trips', plans);
                    resolve({ success: true, data: newPlan });
                    return;
                }

                if (cleanUrl.match(/^\/trip\/book\/\d+$/)) {
                    resolve({ success: true, message: 'Trip package booked!' });
                    return;
                }

                if (cleanUrl === '/payment/create') {
                    resolve({
                        success: true,
                        data: {
                            paymentId: Date.now(),
                            razorpayOrderId: 'ord_mock_' + Date.now(),
                            amount: body.amount * 100,
                            currency: 'INR',
                            key: 'mock_key'
                        }
                    });
                    return;
                }

                if (cleanUrl === '/payment/verify') {
                    const bookings = mockDB.get('bookings');
                    const booking = bookings.find(x => x.id === parseInt(body.bookingId));
                    if (booking) {
                        booking.payment_status = 'paid';
                        booking.booking_status = 'confirmed';
                        mockDB.set('bookings', bookings);
                    }
                    resolve({ success: true, message: 'Payment verified successfully' });
                    return;
                }

                resolve({ success: true, message: 'Mock response' });

            } catch (err) {
                reject(err);
            }
        }, 150);
    });
}

// Register global fetch interceptor to completely decouple frontend from Render backend APIs
const originalFetch = window.fetch;
window.fetch = async function(resource, init = {}) {
    const urlStr = typeof resource === 'string' ? resource : resource.url;
    if (urlStr.includes('/api/') && !urlStr.includes('/api/send-booking')) {
        let endpoint = urlStr.substring(urlStr.indexOf('/api/') + 4);
        console.log(`[Global Fetch Interceptor] Intercepted: ${endpoint}`);
        try {
            const data = await apiFetch(endpoint, init);
            return {
                ok: true,
                status: 200,
                headers: new Headers({ 'Content-Type': 'application/json' }),
                json: async () => data,
                text: async () => JSON.stringify(data)
            };
        } catch (err) {
            return {
                ok: false,
                status: 400,
                headers: new Headers({ 'Content-Type': 'application/json' }),
                json: async () => ({ success: false, error: err.message }),
                text: async () => JSON.stringify({ success: false, error: err.message })
            };
        }
    }
    return originalFetch(resource, init);
};

// ─── Location Service (High-Accuracy GPS Lock) ──────────
const Location = {
    current: { lat: 11.7800, lng: 78.2100, address: 'Detecting location...', accuracy: null },
    _watchId: null,

    async detect() {
        const btn = document.getElementById('locationBtn');
        const display = document.getElementById('locationDisplay');
        const fallback = document.getElementById('locationFallback');

        if (!navigator.geolocation) {
            Toast.show('Geolocation is not supported by your browser.', 'error');
            if (fallback) fallback.classList.remove('hidden');
            return this.current;
        }

        // Clear any previous watch
        if (this._watchId !== null) {
            navigator.geolocation.clearWatch(this._watchId);
            this._watchId = null;
        }

        if (btn) btn.innerHTML = `<span class="spinner"></span> Finding you...`;
        if (display) { 
            display.style.display = 'block'; 
            display.innerHTML = `<span class="pulse" style="color:var(--primary)">•</span> Acquiring GPS signal...`; 
        }

        return new Promise((resolve) => {
            let bestPosition = null;
            const startTime = Date.now();
            
            // Tiered Resolution Strategy
            const MAX_WAIT_MS = 12000;      // Hard limit
            const IDEAL_ACCURACY = 30;      // Metres (Excellent)
            const GOOD_ENOUGH_ACCURACY = 80; // Metres (Acceptable for pickup)
            const MIN_WAIT_MS = 3000;       // Minimum time to let GPS "warm up"

            const timer = setTimeout(() => {
                if (this._watchId !== null) {
                    navigator.geolocation.clearWatch(this._watchId);
                    this._watchId = null;
                }
                if (bestPosition) {
                    this._finalize(bestPosition, btn, display, fallback, resolve);
                } else {
                    Toast.show('GPS signal is weak. Please move outdoors or turn on high-accuracy mode.', 'warning');
                    if (fallback) fallback.classList.remove('hidden');
                    if (btn) btn.innerHTML = `<i class="ph ph-warning-circle"></i> Retry GPS`;
                    resolve(this.current);
                }
            }, MAX_WAIT_MS);

            this._watchId = navigator.geolocation.watchPosition(
                (pos) => {
                    const acc = pos.coords.accuracy;
                    const elapsed = Date.now() - startTime;

                    if (btn) btn.innerHTML = `<span class="spinner"></span> Signal: ±${Math.round(acc)}m`;

                    if (!bestPosition || acc < bestPosition.coords.accuracy) {
                        bestPosition = pos;
                    }

                    // RESOLUTION LOGIC
                    // 1. Excellent lock
                    if (acc <= IDEAL_ACCURACY) {
                        finish();
                    } 
                    // 2. Good enough lock after a short wait
                    else if (acc <= GOOD_ENOUGH_ACCURACY && elapsed >= MIN_WAIT_MS) {
                        finish();
                    }
                },
                (err) => {
                    clearTimeout(timer);
                    if (this._watchId !== null) {
                        navigator.geolocation.clearWatch(this._watchId);
                        this._watchId = null;
                    }

                    if (err.code === 1) {
                        Toast.show('Location permission denied. Enable it in browser settings.', 'error');
                    } else if (err.code === 2) {
                        // GPS IS OFF OR UNAVAILABLE
                        if (window.Swal) {
                            Swal.fire({
                                title: 'GPS is OFF',
                                text: 'Please turn on your device location/GPS and try again for accurate service.',
                                icon: 'warning',
                                confirmButtonText: 'I turned it on',
                                confirmButtonColor: 'var(--primary)'
                            }).then(() => {
                                if (btn) btn.innerHTML = `<i class="ph ph-gps"></i> Enable GPS`;
                            });
                        } else {
                            Toast.show('GPS is disabled. Please turn it on in settings.', 'error');
                        }
                    } else {
                        Toast.show('GPS timeout. Try moving to an open area.', 'error');
                    }
                    
                    if (fallback) fallback.classList.remove('hidden');
                    if (btn) btn.innerHTML = `<i class="ph ph-warning"></i> Retry`;
                    resolve(this.current);
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );

            function finish() {
                clearTimeout(timer);
                if (Location._watchId !== null) {
                    navigator.geolocation.clearWatch(Location._watchId);
                    Location._watchId = null;
                }
                Location._finalize(bestPosition, btn, display, fallback, resolve);
            }
        });
    },

    async _finalize(pos, btn, display, fallback, resolve) {
        this.current.lat      = pos.coords.latitude;
        this.current.lng      = pos.coords.longitude;
        this.current.accuracy = Math.round(pos.coords.accuracy);

        // Reverse geocode with BigDataCloud (free, no API key, street-level precision)
        try {
            const url = `https://api.bigdatacloud.net/data/reverse-geocode-client` +
                        `?latitude=${this.current.lat}&longitude=${this.current.lng}&localityLanguage=en`;
            const res  = await fetch(url);
            const data = await res.json();

            // Build a clean, human-readable address
            const parts = [
                data.locality || data.city,
                data.principalSubdivision,
                data.countryName
            ].filter(Boolean);

            const streetParts = [
                data.streetNumber ? `${data.streetNumber}` : '',
                data.street || data.localityInfo?.informative?.[0]?.name || ''
            ].filter(Boolean).join(' ');

            const fullAddr = [streetParts, ...parts].filter(Boolean).join(', ');
            this.current.address = fullAddr || `${this.current.lat.toFixed(6)}, ${this.current.lng.toFixed(6)}`;
        } catch (e) {
            // Fallback: show raw coords if reverse geocoding fails
            this.current.address = `${this.current.lat.toFixed(6)}, ${this.current.lng.toFixed(6)}`;
        }

        // Update UI
        if (display) {
            display.style.display = 'block';
            display.innerHTML =
                `<i class="ph ph-map-pin" style="color:var(--primary)"></i> ${this.current.address}` +
                `<span style="float:right; font-size:0.75rem; color:var(--success); font-weight:700;">` +
                `±${this.current.accuracy}m</span>`;
        }
        if (btn) {
            btn.innerHTML = `<i class="ph ph-check-circle"></i> Location Locked (±${this.current.accuracy}m)`;
            btn.style.borderColor = 'var(--success)';
            btn.style.color = 'var(--success)';
        }
        if (fallback) fallback.classList.remove('hidden');

        resolve(this.current);
    },

    setManual(addr) {
        this.current.address = addr;
        const display = document.getElementById('locationDisplay');
        if (display) {
            display.innerHTML = `<i class="ph ph-pencil" style="color:var(--accent)"></i> ${addr}`;
            display.style.display = 'block';
            display.style.borderColor = 'var(--accent)';
        }
    }
};

// ─── Toast Notification ─────────────────────────────────
const Toast = {
    el: null,
    init() {
        if (this.el) return;
        this.el = document.createElement('div');
        this.el.className = 'toast';
        document.body.appendChild(this.el);
    },
    show(msg, type = 'success') {
        this.init();
        this.el.className = `toast ${type}`;
        this.el.innerHTML = `<i class="ph ph-${type === 'success' ? 'check-circle' : type === 'error' ? 'warning-circle' : 'info'}"></i> ${msg}`;
        this.el.classList.add('show');
        setTimeout(() => this.el.classList.remove('show'), 3500);
    }
};

// ─── Navbar Scroll + Auth UI ────────────────────────────
function initNavbar() {
    const nav = document.getElementById('navbar');
    if (!nav) return;

    window.addEventListener('scroll', () => {
        nav.classList.toggle('scrolled', window.scrollY > 50);
    });

    // Update login/logout button
    const loginBtn = document.getElementById('loginBtn');
    const dashBtn = document.getElementById('dashBtn');
    const adminBtn = document.getElementById('adminBtn');
    const vendorBtn = document.getElementById('vendorBtn');

    if (Auth.isLoggedIn()) {
        if (loginBtn) {
            loginBtn.innerHTML = '<i class="ph ph-sign-out"></i> Logout';
            loginBtn.onclick = (e) => { e.preventDefault(); Auth.logout(); };
        }
        if (dashBtn) dashBtn.classList.remove('hidden');
        if (adminBtn && Auth.isAdmin()) adminBtn.classList.remove('hidden');
        if (vendorBtn && Auth.isVendor()) vendorBtn.classList.remove('hidden');
    } else {
        if (loginBtn) {
            loginBtn.onclick = (e) => {
                e.preventDefault();
                const modal = document.getElementById('authModal');
                if (modal) modal.classList.add('active');
            };
        }
    }
}

// ─── Auth Modal Logic ───────────────────────────────────
function initAuthModal() {
    const modal = document.getElementById('authModal');
    const closeBtn = document.getElementById('closeModal');
    const toggleBtn = document.getElementById('authToggleBtn');
    const form = document.getElementById('authForm');

    if (!modal) return;

    let isRegister = false;
    let isVerifying = false;
    let registeredEmail = '';

    if (closeBtn) closeBtn.onclick = () => { modal.classList.remove('active'); resetAuthUI(); };
    modal.addEventListener('click', (e) => { if (e.target === modal) { modal.classList.remove('active'); resetAuthUI(); } });

    function resetAuthUI() {
        isVerifying = false;
        sessionStorage.removeItem('auth_redirect');
        const els = {
            otp: document.getElementById('otpContainer'),
            pass: document.getElementById('passwordGroup'),
            email: document.getElementById('emailGroup'),
            name: document.getElementById('nameGroup'),
            submit: document.getElementById('authSubmitBtn'),
            resend: document.getElementById('resendOTPBtn')
        };
        if (els.otp) els.otp.style.display = 'none';
        if (els.pass) els.pass.style.display = 'block';
        if (els.email) els.email.style.display = isRegister ? 'block' : 'none';
        if (els.name) els.name.style.display = isRegister ? 'block' : 'none';
        if (els.submit) els.submit.textContent = isRegister ? 'Register' : 'Sign In';
        if (els.resend) els.resend.style.display = 'none';
    }

    if (toggleBtn) {
        toggleBtn.onclick = (e) => {
            e.preventDefault();
            if (isVerifying) return; // Prevent toggle during verification
            isRegister = !isRegister;
            document.getElementById('nameGroup').style.display = isRegister ? 'block' : 'none';
            document.getElementById('emailGroup').style.display = isRegister ? 'block' : 'none';
            document.getElementById('authTitle').textContent = isRegister ? 'Create Account' : 'Welcome Back';
            document.getElementById('authSubtitle').textContent = isRegister
                ? 'Join Yercaud\'s ultimate travel platform.' : 'Sign in to continue your journey.';
            document.getElementById('authSubmitBtn').textContent = isRegister ? 'Register' : 'Sign In';
            toggleBtn.textContent = isRegister ? 'Sign In' : 'Register';
            document.getElementById('authToggleText').textContent = isRegister
                ? 'Already have an account?' : 'Don\'t have an account?';
        };
    }

    const resendBtn = document.getElementById('resendOTPBtn');
    if (resendBtn) {
        resendBtn.onclick = async () => {
            try {
                await apiFetch('/auth/resend-otp', { method: 'POST', body: { email: registeredEmail } });
                Toast.show('Code resent successfully');
            } catch (err) { Toast.show(err.message, 'error'); }
        };
    }

    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            const btn = document.getElementById('authSubmitBtn');
            const orig = btn.textContent;

            try {
                const phone = document.getElementById('authPhone')?.value;
                const password = document.getElementById('authPassword')?.value;
                const otp = document.getElementById('authOTP')?.value || null;
                const email = isRegister ? document.getElementById('authEmail')?.value : null;

                // Scenario 1: Verification Step
                if (isVerifying) {
                    btn.innerHTML = '<span class="spinner"></span> Creating Account...';
                    const payload = {
                        name: document.getElementById('authName')?.value || 'Guest',
                        email,
                        phone,
                        password,
                        otp,
                        role: 'customer'
                    };

                    const data = await apiFetch('/auth/register', { method: 'POST', body: payload });
                    Auth.save(data.token, data.user);
                    Toast.show('Account created successfully!');
                    modal.classList.remove('active');
                    resetAuthUI();
                    setTimeout(() => window.location.href = 'dashboard', 1000);
                    return;
                }

                // Scenario 2: Standard Login
                if (!isRegister) {
                    btn.innerHTML = '<span class="spinner"></span> Validating...';
                    const data = await apiFetch('/auth/login', { method: 'POST', body: { phone, password } });
                    Auth.save(data.token, data.user);
                    Toast.show(`Welcome back, ${data.user.name}!`);
                    modal.classList.remove('active');
                    const pages = {
                        admin: 'admin',
                        driver: 'driver-dashboard',
                        delivery: 'delivery-dashboard',
                        vendor: data.user.business_type === 'restaurant' ? 'restaurant-dashboard' : 'resort-dashboard'
                    };

                    const redirect = sessionStorage.getItem('auth_redirect');
                    sessionStorage.removeItem('auth_redirect');

                    setTimeout(() => {
                        if (redirect) {
                            window.location.href = redirect;
                        } else if (pages[data.user.role]) {
                            window.location.href = pages[data.user.role];
                        } else {
                            window.location.reload();
                        }
                    }, 1000);
                    return;
                }

                // Scenario 3: Trigger OTP for Registration
                btn.innerHTML = '<span class="spinner"></span> Sending Code...';
                await apiFetch('/auth/send-otp', { method: 'POST', body: { email } });

                isVerifying = true;
                registeredEmail = email;

                const groups = ['otpContainer', 'passwordGroup', 'nameGroup', 'emailGroup', 'phoneGroup', 'resendOTPBtn'];
                groups.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.style.display = (id === 'otpContainer' || id === 'resendOTPBtn') ? 'block' : 'none';
                });

                btn.textContent = 'Complete Registration';
                Toast.show('Verification code sent to your email');

            } catch (err) {
                Toast.show(err.message, 'error');
                btn.textContent = orig;
            }
        };
    }
}

// ─── Cart System ────────────────────────────────────────
const Cart = {
    items: [],
    vendorId: null,
    type: 'food',

    init() {
        try {
            const saved = JSON.parse(safeStorage.getItem('yercaud_cart') || '{}');
            this.items = saved.items || [];
            this.vendorId = saved.vendorId || null;
            this.type = saved.type || 'food';
            this.render();
        } catch (e) { console.warn('Cart init failed'); }
    },

    save() {
        safeStorage.setItem('yercaud_cart', JSON.stringify({
            items: this.items,
            vendorId: this.vendorId,
            type: this.type
        }));
    },

    add(item) {
        // Strict single-restaurant enforcement
        if (this.vendorId && this.vendorId !== item.vendor_id) {
            if (!confirm('Choosing item from another restaurant will clear the cart. Continue?')) return;
            this.clear();
        }

        this.vendorId = item.vendor_id;
        const existing = this.items.find(i => i.id === item.id);
        if (existing) {
            existing.quantity++;
        } else {
            this.items.push({ ...item, quantity: 1 });
        }

        this.save();
        this.render();
        Toast.show(`${item.item_name || item.name} added to cart`);
    },

    remove(id) {
        this.items = this.items.filter(i => i.id !== id);
        if (this.items.length === 0) this.vendorId = null;
        this.save();
        this.render();
    },

    updateQty(id, delta) {
        const item = this.items.find(i => i.id === id);
        if (!item) return;
        item.quantity += delta;
        if (item.quantity <= 0) this.remove(id);
        else { this.save(); this.render(); }
    },

    getTotal() {
        return this.items.reduce((sum, i) => sum + (parseFloat(i.price) * i.quantity), 0);
    },

    clear() {
        this.items = [];
        this.vendorId = null;
        this.save();
        this.render();
    },

    render() {
        const cartItems = document.getElementById('cartItems');
        const cartCount = document.getElementById('cartCount');
        const cartTotal = document.getElementById('cartTotal');
        // Custom cart total for food page if exists
        const subEl = document.getElementById('cartSubtotal');
        const totEl = document.getElementById('cartTotal');

        if (!cartItems) return;

        const totalQty = this.items.reduce((s, i) => s + i.quantity, 0);
        if (cartCount) cartCount.textContent = totalQty;

        if (this.items.length === 0) {
            cartItems.innerHTML = '<p class="text-muted text-center mt-4">Your cart is empty</p>';
        } else {
            cartItems.innerHTML = this.items.map(i => `
                <div class="cart-item">
                    <div class="cart-item-info">
                        <h4>${i.item_name || i.name}</h4>
                        <p>₹${i.price} × ${i.quantity} = ₹${(parseFloat(i.price) * i.quantity).toFixed(2)}</p>
                    </div>
                    <div class="cart-item-qty">
                        <button onclick="Cart.updateQty(${i.id}, -1)">−</button>
                        <span>${i.quantity}</span>
                        <button onclick="Cart.updateQty(${i.id}, 1)">+</button>
                    </div>
                </div>
            `).join('');
        }

        const subtotal = this.getTotal();
        if (cartTotal) cartTotal.textContent = `₹${subtotal.toFixed(2)}`;

        // Handle specific food page totals if present
        if (subEl) subEl.textContent = `₹${subtotal.toFixed(2)}`;
        if (totEl) {
            const taxPlusDelivery = subtotal > 0 ? 30 : 0;
            totEl.textContent = `₹${(subtotal + taxPlusDelivery).toFixed(2)}`;
        }
    },

    toggle() {
        const sidebar = document.querySelector('.cart-sidebar');
        const overlay = document.querySelector('.cart-overlay');
        sidebar?.classList.toggle('open');
        overlay?.classList.toggle('open');
        
        // Add class to body to allow hiding other floating elements
        if (sidebar?.classList.contains('open')) {
            document.body.classList.add('cart-open');
        } else {
            document.body.classList.remove('cart-open');
        }
    },

    async checkout() {
        if (this.items.length === 0) return Toast.show('Cart is empty', 'error');

        const name = document.getElementById('orderCustName')?.value;
        const phone = document.getElementById('orderCustPhone')?.value;
        const email = document.getElementById('orderCustEmail')?.value;

        if (!name || !phone || !email) {
            Toast.show('Please fill in your name, phone, and email details in the cart', 'warning');
            return;
        }

        // Ensure location is captured
        if (!Location.current.lat || Location.current.address === 'Detecting location...') {
            Toast.show('Please capture your current location first', 'error');
            document.getElementById('locationBtn')?.scrollIntoView({ behavior: 'smooth' });
            return;
        }

        if (!confirm('CONFIRM ORDER: This order is final. Once placed, it cannot be cancelled or changed. Proceed?')) {
            return;
        }

        const checkoutBtn = document.querySelector('.btn-checkout');
        const origText = checkoutBtn ? checkoutBtn.innerHTML : 'Checkout';
        if (checkoutBtn) {
            checkoutBtn.disabled = true;
            checkoutBtn.innerHTML = '<span class="spinner"></span> Placing Order...';
        }

        try {
            const subtotal = this.getTotal();
            const taxPlusDelivery = 30; // standard delivery & platform fees in mock
            const total = subtotal + taxPlusDelivery;

            const itemsStr = this.items.map(i => `${i.item_name || i.name} x${i.quantity} (₹${i.price})`).join(', ');

            // Try to extract the restaurant name from the DOM if available
            const restaurantName = document.getElementById('currentRestaurantName')?.innerText || 'Yercaud Local Kitchens';

            const response = await fetch('/api/send-booking', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'food',
                    name: name,
                    email: email,
                    phone: phone,
                    details: {
                        restaurantId: this.vendorId,
                        restaurantName: restaurantName,
                        itemsList: itemsStr,
                        deliveryAddress: Location.current.address,
                        totalAmount: total.toFixed(2)
                    }
                })
            });

            const data = await response.json();
            if (data.success) {
                Swal.fire({
                    title: 'Order Placed!',
                    text: 'Your food order request has been received. We will contact you via email or phone shortly for confirmation.',
                    icon: 'success',
                    confirmButtonColor: 'var(--primary)'
                }).then(() => {
                    Cart.clear();
                    Cart.toggle();
                    location.reload();
                });
            } else {
                throw new Error(data.error || 'Failed to send order request');
            }
        } catch (err) {
            Toast.show(err.message, 'error');
            if (checkoutBtn) {
                checkoutBtn.disabled = false;
                checkoutBtn.innerHTML = origText;
            }
        }
    }
};

// ─── UI COMPONENTS ──────────────────────────────────────
const UI = {
    showPaymentStatus(success, message, onDone) {
        const id = 'paymentStatusModal';
        let existing = document.getElementById(id);
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = id;
        modal.className = 'modal-overlay active';
        modal.style.zIndex = '9999';

        const content = `
            <div class="modal-content text-center" style="max-width: 400px; padding: 3rem 2rem;">
                <div style="width: 80px; height: 80px; border-radius: 50%; background: ${success ? '#ecfdf5' : '#fef2f2'}; color: ${success ? '#10b981' : '#ef4444'}; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem; font-size: 3rem;">
                    <i class="ph ${success ? 'ph-check-circle' : 'ph-x-circle'}"></i>
                </div>
                <h2 style="font-family: 'Outfit'; margin-bottom: 0.5rem;">${success ? 'Payment Successful!' : 'Payment Failed'}</h2>
                <p style="color: #64748b; margin-bottom: 2rem; line-height: 1.6;">${message}</p>
                <button class="btn ${success ? 'btn-primary' : 'btn-outline'} btn-full" id="paymentStatusDone">
                    ${success ? 'Continue' : 'Try Again'}
                </button>
            </div>
        `;

        modal.innerHTML = content;
        document.body.appendChild(modal);

        document.getElementById('paymentStatusDone').onclick = () => {
            modal.remove();
            if (onDone) onDone();
        };
    },
    showOrderSummary(title, details, amount, onConfirm) {
        const id = 'orderSummaryModal';
        let existing = document.getElementById(id);
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = id;
        modal.className = 'modal-overlay active';
        // Use an extreme z-index to ensure it covers even the bottom-nav (99999)
        modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); backdrop-filter:blur(12px); display:flex; align-items:center; justify-content:center; z-index:1000000; padding:20px;';

        const content = `
            <div class="modal-content animate-slide-up" style="max-width: 420px; width:100%; background: white; border-radius: 32px; overflow:hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);">
                <div style="background: #f8fafc; padding: 2rem 1.5rem; border-bottom: 1px solid #f1f5f9;">
                    <h2 style="font-family: 'Outfit'; margin:0; font-size: 1.5rem; color: #0F172A; display: flex; align-items: center; gap: 12px;">
                        <i class="ph ph-receipt" style="color:var(--primary)"></i> Order Summary
                    </h2>
                    <p style="color: #64748b; font-size: 0.85rem; margin: 8px 0 0 0; line-height: 1.4;">${title}</p>
                </div>
                
                <div style="padding: 1.5rem;">
                    <div style="background: #f8fafc; padding: 1.25rem; border-radius: 20px; border: 1px solid #f1f5f9; margin-bottom: 1.5rem;">
                        ${details.map(d => `
                            <div class="flex justify-between items-center mb-3">
                                <span style="font-size:0.9rem; color:#475569; font-weight:500">${d.label}</span>
                                <span style="font-size:0.95rem; color:#0F172A; font-weight:700">${d.value}</span>
                            </div>
                        `).join('')}
                        
                        <div class="flex justify-between items-center pt-4 mt-2" style="border-top: 2px dashed #e2e8f0;">
                            <span style="font-weight: 800; font-size: 1rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Total Payable</span>
                            <span style="font-weight: 900; font-size: 1.6rem; color: #1e3a1a;">₹${amount}</span>
                        </div>
                    </div>

                    <div class="flex flex-col gap-3">
                        <button class="btn btn-primary btn-full py-4" id="summaryConfirmBtn" style="border-radius: 16px; font-weight: 800; font-size: 1.1rem; box-shadow: 0 10px 20px rgba(45,90,39,0.2);">
                            Proceed to Pay <i class="ph ph-shield-check"></i>
                        </button>
                        <button class="btn btn-outline btn-full py-3" onclick="document.getElementById('${id}').remove()" style="border-radius: 14px; color: #94a3b8; border-color: #e2e8f0; font-size: 0.9rem;">
                            Go Back & Edit
                        </button>
                    </div>
                </div>
                
                <div style="background: #f8fafc; padding: 12px; text-align: center; font-size: 0.7rem; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">
                    <i class="ph ph-lock"></i> Secured by Razorpay
                </div>
            </div>
        `;

        modal.innerHTML = content;
        document.body.appendChild(modal);

        document.getElementById('summaryConfirmBtn').onclick = () => {
            modal.remove();
            if (onConfirm) onConfirm();
        };
    },
    renderNavbar(showCart = false) {
        const nav = document.getElementById('navbar');
        if (!nav) return;
        const path = window.location.pathname;

        const isAdminPage = path.includes('admin');
        const isResortPage = path.includes('resort');
        const isRestaurantPage = path.includes('restaurant');
        const isDriverPage = path.includes('driver') || path.includes('delivery');

        // Show navbar for all pages to maintain consistent header experience
        nav.style.display = 'flex';
        const isLoginPage = path.includes('login');

        // Navbar links rendering starts here
        let links = '';

        if (isAdminPage) {
            const user = Auth.getUser('admin');
            links = `
                <span style="font-size:0.75rem; color:rgba(255,255,255,0.6); margin-right:1rem; border:1px solid rgba(255,255,255,0.1); padding:4px 8px; border-radius:6px">
                    <i class="ph ph-shield-check"></i> ID: ${user?.name || 'ADMIN'}
                </span>
                <a href="admin">Terminal</a>
                <button class="btn-logout" onclick="Auth.logout()"><i class="ph ph-sign-out"></i></button>
            `;
        } else if (isResortPage || isRestaurantPage) {
            // Resort/Restaurant Navbar
            const role = isResortPage ? 'resort' : 'restaurant';
            const user = Auth.getUser(role);
            const dashUrl = isResortPage ? 'resort-dashboard' : 'restaurant-dashboard';
            links = `
                <a href="#" onclick="if(window.switchTab) { window.switchTab('profile'); return false; } else { window.location.href='${dashUrl}#profile'; }"><i class="ph ph-user-circle"></i> Profile</a>
                <a href="${dashUrl}"><i class="ph ph-storefront"></i> Dashboard</a>
                <button class="btn-logout" onclick="Auth.logout()"><i class="ph ph-sign-out"></i></button>
            `;
        } else if (isDriverPage) {
            // Driver/Delivery Navbar
            const user = Auth.getUser();
            const dashUrl = user?.role === 'delivery' ? 'delivery-dashboard' : 'driver-dashboard';
            links = `
                <a href="profile"><i class="ph ph-user-circle"></i> Profile</a>
                <a href="${dashUrl}"><i class="ph ph-steering-wheel"></i> Dashboard</a>
                <button class="btn-logout" onclick="Auth.logout()"><i class="ph ph-sign-out"></i></button>
            `;
        } else {
            // Pure Customer Navbar (Serverless Frontend-Only)
            links = `
                <a href="rooms.html"><i class="ph ph-buildings"></i> Stays</a>
                <a href="taxi.html"><i class="ph ph-car"></i> Taxis</a>
                <a href="services.html"><i class="ph ph-sparkles"></i> Celebrations</a>
                <a href="trip-planner.html" class="text-accent" style="font-weight:600"><i class="ph ph-sparkle"></i> Trip Planner</a>
            `;
            if (showCart) {
                links += `
                    <button class="btn btn-accent btn-sm" onclick="Cart.toggle()" style="position:relative">
                        <i class="ph ph-shopping-cart"></i> (<span id="cartCount">0</span>)
                    </button>
                `;
            }
        }

        const logoType = isAdminPage ? 'Admin<span style="font-weight:300">Control</span>' :
            (isResortPage || isRestaurantPage || isDriverPage) ? 'Partner<span style="font-weight:300">Hub</span>' :
                'Book&Sync<span style="font-weight:300"></span>';

        const logoIcon = isAdminPage ? 'ph-shield-check' :
            (isResortPage || isRestaurantPage || isDriverPage) ? 'ph-storefront' : 'ph-mountains';

        const logoUrl = isAdminPage ? 'admin' :
            isResortPage ? 'resort-dashboard' :
                isRestaurantPage ? 'restaurant-dashboard' :
                    isDriverPage ? 'driver-dashboard' : 'index.html';

        const profileIconHtml = Auth.isLoggedIn() ? `
            <a href="profile" class="nav-profile-mobile">
                <i class="ph ph-user-circle"></i>
            </a>` : '';

        nav.innerHTML = `
            <a href="${logoUrl}" class="logo">
                <div class="logo-initials">B&S</div>
                <span class="logo-text">${logoType}</span>
            </a>
            <div class="nav-links" id="navLinks">
                ${links}
            </div>
            <div class="nav-actions">
                ${profileIconHtml}
                <button class="hamburger" id="hamburgerBtn" aria-label="Open menu">
                    <span></span><span></span><span></span>
                </button>
            </div>
        `;

        // Hamburger toggle logic
        const hamburger = document.getElementById('hamburgerBtn');
        const navLinks = document.getElementById('navLinks');
        if (hamburger && navLinks) {
            hamburger.addEventListener('click', (e) => {
                e.stopPropagation();
                hamburger.classList.toggle('open');
                navLinks.classList.toggle('open');
            });
            // Close on link click
            navLinks.querySelectorAll('a').forEach(a => {
                a.addEventListener('click', () => {
                    hamburger.classList.remove('open');
                    navLinks.classList.remove('open');
                });
            });
            // Close on outside click
            document.addEventListener('click', (e) => {
                if (!hamburger.contains(e.target) && !navLinks.contains(e.target)) {
                    hamburger.classList.remove('open');
                    navLinks.classList.remove('open');
                }
            });
        }

        window.addEventListener('scroll', () => {
            nav.classList.toggle('scrolled', window.scrollY > 50);
        });
    },

    renderHeader(title, subtitle, gradient, showBack = true) {
        const header = document.querySelector('.page-header');
        if (!header) return;
        header.style.background = gradient || 'linear-gradient(135deg, var(--primary-dark), var(--primary-light))';
        header.innerHTML = `
            <div class="container">
                ${showBack ? '<a href="javascript:history.back()" class="btn-back"><i class="ph ph-arrow-left"></i> Back</a>' : ''}
                <h1 style="font-family:Outfit; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 12px;">${title}</h1>
                <p style="font-size: 1.1rem; opacity: 0.9; max-width: 600px;">${subtitle}</p>
            </div>
        `;
    },
    toggleAuthModal(show = true) {
        const modal = document.getElementById('authModal');
        if (modal) {
            if (show) modal.classList.add('active');
            else modal.classList.remove('active');
        }
    },
    requireAuth(url) {
        if (Auth.isLoggedIn('customer')) {
            window.location.href = url;
        } else {
            sessionStorage.setItem('auth_redirect', url);
            Toast.show('Please sign in to access this service', 'info');
            this.toggleAuthModal(true);
        }
    },
    renderCustomerStatus() {
        const user = Auth.getUser('customer');
        if (!user) return;

        const h1 = document.querySelector('.hero h1');
        const p = document.querySelector('.hero p');

        if (h1) h1.innerHTML = `Welcome back, <span class="text-primary">${user.name.split(' ')[0]}</span>`;
        if (p) {
            p.innerHTML = `
                Continue your Yercaud adventure. Your personalized super app is ready.<br>
                <button onclick="document.querySelector('.section').scrollIntoView({behavior:'smooth'})" class="btn btn-primary btn-sm mt-3" style="border-radius:12px; padding: 10px 20px;">
                    Start Your Journey <i class="ph ph-arrow-down"></i>
                </button>
            `;
        }

        // Add a status bar above services if on index
        if (window.location.pathname.endsWith('index') || window.location.pathname === '/') {
            const section = document.querySelector('.hero');
            if (section && !document.getElementById('customerStatus')) {
                const statusHtml = `
                    <div id="customerStatus" class="container" style="margin-top:-2rem; position:relative; z-index:10">
                        <div class="card flex justify-between items-center" style="padding:1rem 1.5rem; border-radius:16px; background:white; border:1px solid var(--primary-light); box-shadow: var(--shadow-lg)">
                            <div class="flex items-center gap-3">
                                <div style="width:12px; height:12px; background:#22c55e; border-radius:50%; box-shadow: 0 0 10px #22c55e"></div>
                                <span style="font-weight:600; color:var(--primary-dark)">Active Session: ${user.phone}</span>
                            </div>
                            <div class="flex gap-3">
                                <a href="dashboard" class="btn btn-primary btn-sm" style="border-radius:10px">Manage Orders</a>
                                <button onclick="Auth.logout()" class="btn btn-outline btn-sm" style="border-radius:10px">Logout</button>
                            </div>
                        </div>
                    </div>
                `;
                section.insertAdjacentHTML('afterend', statusHtml);
            }
        }
    },

    initInteractivity() {
        // 1. Reveal on scroll
        const reveals = document.querySelectorAll('.card, .section-title, .section-subtitle, .stat-card, .hero h1, .hero p, .page-header h1, .page-header p, .grid, .history-table, .reveal');
        reveals.forEach(el => el.classList.add('reveal'));

        const observerOptions = { threshold: 0.1, rootMargin: '0px 0px -50px 0px' };
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('active');
                }
            });
        }, observerOptions);

        reveals.forEach(el => observer.observe(el));

        // 2. Dynamic link highlights
        const currentPath = window.location.pathname;
        document.querySelectorAll('.nav-links a').forEach(link => {
            if (currentPath.includes(link.getAttribute('href'))) {
                link.classList.add('active');
                link.style.color = 'var(--accent)';
            }
        });
    },

    async updateMobileDashboard() {
        if (!Auth.isLoggedIn('customer')) return;
        const rideWidget = document.getElementById('activeRideWidget');
        const foodWidget = document.getElementById('activeFoodWidget');
        const offersScroll = document.getElementById('offersScroll');

        if (!rideWidget && !foodWidget && !offersScroll) return;

        try {
            const res = await apiFetch('/auth/dashboard-summary');
            if (!res.success) return;

            const { bookings, orders, trips } = res.data;

            // 1. Handle Active Ride
            const activeRide = bookings.find(b => b.module_type === 'taxi' && !['completed', 'cancelled'].includes(b.booking_status));
            if (activeRide && rideWidget) {
                rideWidget.style.display = 'block';
                const destEl = document.getElementById('rideDestination');
                if (destEl) destEl.textContent = activeRide.dropoff_location || 'To Destination';
                
                const statusEl = document.getElementById('rideStatus');
                const timeText = document.getElementById('rideTimeText');
                
                // Map statuses to requested simplified labels
                const statusMap = {
                    'pending': 'Requested',
                    'requested': 'Requested',
                    'confirmed': 'Confirmed',
                    'accepted': 'Confirmed',
                    'in_progress': 'Ongoing'
                };

                const currentStatus = statusMap[activeRide.booking_status] || 'Active';

                if (activeRide.booking_status === 'in_progress' || activeRide.booking_status === 'accepted') {
                    const partnerInfo = document.getElementById('ridePartnerInfo');
                    const driver = document.getElementById('rideDriver');
                    const vehicle = document.getElementById('rideVehicle');
                    
                    if (partnerInfo) {
                        partnerInfo.style.display = 'flex';
                        if (driver) driver.textContent = activeRide.driver_name || 'Professional Pilot';
                        if (vehicle) vehicle.textContent = `${activeRide.vehicle_model || 'Premium Sedan'} • ${activeRide.vehicle_number || 'TN -- ----'}`;
                    }

                    if (timeText) {
                        timeText.textContent = activeRide.booking_status === 'in_progress' ? 'Journey Ongoing' : 'Pilot arriving soon';
                    }
                } else {
                    const partnerInfo = document.getElementById('ridePartnerInfo');
                    if (partnerInfo) partnerInfo.style.display = 'none';
                    if (timeText) timeText.textContent = 'Awaiting Confirmation';
                }

                if (statusEl) statusEl.textContent = currentStatus;

                const progressMap = { pending: 15, confirmed: 35, accepted: 55, in_progress: 85 };
                const p = progressMap[activeRide.booking_status] || 10;
                const pBar = document.getElementById('rideProgress');
                if (pBar) pBar.style.width = p + '%';
            } else if (rideWidget) {
                rideWidget.style.display = 'none';
            }

            // 2. Handle Active Food Order
            const activeFood = orders.find(o => !['delivered', 'cancelled'].includes(o.status));
            if (activeFood && foodWidget) {
                foodWidget.style.display = 'block';
                const foodRestEl = document.getElementById('foodRestaurant');
                const foodIdEl   = document.getElementById('foodOrderID');
                if (foodRestEl) foodRestEl.textContent = activeFood.business_name || 'Restaurant';
                if (foodIdEl)   foodIdEl.textContent   = `Order #${activeFood.id}`;

                const badge = document.getElementById('foodBadge');
                if (badge) {
                    badge.textContent = activeFood.status.toUpperCase();
                }
                
                const progressMap = { placed: 15, confirmed: 35, preparing: 60, ready_for_pickup: 80, out_for_delivery: 95 };
                const p = progressMap[activeFood.status] || 10;
                const pBar = document.getElementById('foodProgress');
                if (pBar) pBar.style.width = p + '%';
                
                const statusText = document.getElementById('foodStatus');
                if (statusText) statusText.textContent = `Status: ${activeFood.status.replace(/_/g, ' ')}`;
            } else if (foodWidget) {
                foodWidget.style.display = 'none';
            }

            // 3. Handle Active Tour (Trip Plan)
            const tourWidget = document.getElementById('activeTourWidget');
            const activeTour = trips && trips.length > 0 ? trips[0] : null; 
            
            if (activeTour && tourWidget) {
                const ageInDays = (Date.now() - new Date(activeTour.created_at).getTime()) / (1000 * 60 * 60 * 24);
                if (ageInDays < 7) {
                    tourWidget.style.display = 'block';
                    document.getElementById('tourName').textContent = activeTour.title || 'Yercaud Exploration';
                    
                    const progress = Math.min(100, Math.max(10, (ageInDays / 3) * 100)); 
                    const pBar = document.getElementById('tourProgress');
                    if (pBar) pBar.style.width = progress + '%';
                    
                    const statusText = document.getElementById('tourStatus');
                    if (statusText) statusText.textContent = 'Live Itinerary';
                } else {
                    tourWidget.style.display = 'none';
                }
            } else if (tourWidget) {
                tourWidget.style.display = 'none';
            }

            // 4. Handle Offers
            if (offersScroll) {
                const offRes = await apiFetch('/api/offers/active');
                if (offRes.success && offRes.data) {
                    offersScroll.innerHTML = offRes.data.map(o => `
                        <a href="${o.link_url || '#'}" class="offer-card" style="background-image: linear-gradient(rgba(0,0,0,0.1), rgba(0,0,0,0.6)), url('${o.image_url}');">
                            <div class="offer-content">
                                ${o.badge ? `<span class="offer-badge">${o.badge}</span>` : ''}
                                <p class="offer-title">${o.title}</p>
                                <p class="offer-subtitle">${o.subtitle}</p>
                            </div>
                        </a>
                    `).join('');
                }
            }

        } catch (err) {
            console.warn('Dashboard update failed', err);
        }
    },

};
// ─── AI ChatBot Assistant ──────────────────────────────
const ChatBot = {
    history: [],
    isOpen: false,

    init() {
        const html = `
            <div class="chat-widget">
                <div class="chat-window" id="chatWindow">
                    <div class="chat-header">
                        <img src="https://ui-avatars.com/api/?name=Book%26Sync+AI&background=0D8ABC&color=fff" alt="Book&Sync AI">
                        <div>
                            <div style="font-weight:700">Book&Sync Assistant</div>
                            <div style="font-size:0.7rem; opacity:0.8">Online | Powered by Gemini</div>
                        </div>
                        <button class="btn btn-sm btn-accent" onclick="Support.toggleModal(true)" style="margin-left: auto; font-size: 0.75rem; padding: 6px 12px; border-radius: 8px; box-shadow: 0 4px 10px rgba(232, 168, 58, 0.3);">
                            <i class="ph ph-first-aid"></i> Raise Complaint
                        </button>
                    </div>
                    <div class="chat-messages" id="chatMessages">
                        <div class="msg msg-bot">Hello! I'm your Book&Sync Assistant. How can I help you explore Yercaud today? 🏔️</div>
                    </div>
                    <form class="chat-input-area" id="chatForm">
                        <input type="text" id="chatInput" placeholder="Ask about taxis, rooms, or food..." autocomplete="off">
                        <button type="submit"><i class="ph ph-paper-plane-right"></i></button>
                    </form>
                </div>
                <button class="chat-btn" id="chatToggleBtn"><i class="ph ph-chats-teardrop"></i></button>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);

        const btn = document.getElementById('chatToggleBtn');
        const form = document.getElementById('chatForm');

        btn.onclick = () => this.toggle();
        form.onsubmit = (e) => {
            e.preventDefault();
            this.send();
        };
    },

    toggle() {
        this.isOpen = !this.isOpen;
        document.getElementById('chatWindow').classList.toggle('active', this.isOpen);
        document.getElementById('chatToggleBtn').classList.toggle('active', this.isOpen);
        document.getElementById('chatToggleBtn').innerHTML = this.isOpen ? '<i class="ph ph-x"></i>' : '<i class="ph ph-chats-teardrop"></i>';
        if (this.isOpen) document.getElementById('chatInput').focus();
    },

    async send() {
        const input = document.getElementById('chatInput');
        const text = input.value.trim();
        if (!text) return;

        this.renderMessage(text, 'user');
        input.value = '';

        // Typing indicator
        const indicator = document.createElement('div');
        indicator.className = 'msg msg-bot';
        indicator.innerHTML = '<span class="spinner-sm"></span> AI is thinking...';
        indicator.id = 'typingIndicator';
        document.getElementById('chatMessages').appendChild(indicator);
        this.scrollToBottom();

        try {
            const res = await apiFetch('/chat', {
                method: 'POST',
                body: { message: text, history: this.history }
            });

            document.getElementById('typingIndicator').remove();

            if (res.success) {
                this.renderMessage(res.reply, 'bot');
                // Update history for context
                this.history.push({ role: 'user', parts: [{ text }] });
                this.history.push({ role: 'model', parts: [{ text: res.reply }] });
            } else {
                const errorMsg = res.details ? `Error: ${res.details}` : "I'm having trouble connecting right now.";
                this.renderMessage(errorMsg, 'bot');
            }
        } catch (error) {
            document.getElementById('typingIndicator').remove();
            this.renderMessage(`Sorry, I encountered an error: ${error.message}`, 'bot');
        }
    },

    renderMessage(text, side) {
        const msgs = document.getElementById('chatMessages');
        const div = document.createElement('div');
        div.className = `msg msg-${side}`;
        div.innerText = text;
        msgs.appendChild(div);
        this.scrollToBottom();
    },

    scrollToBottom() {
        const msgs = document.getElementById('chatMessages');
        msgs.scrollTop = msgs.scrollHeight;
    }
};

window.UI = UI;
window.Cart = Cart;
window.Auth = Auth;
window.apiFetch = apiFetch;
window.Toast = Toast;
window.ChatBot = ChatBot;

// ─── Support & Complaint System ─────────────────────────
const Support = {
    init() {
        const html = `
            <div id="complaintModal" class="modal-overlay">
                <div class="modal-content" style="max-width: 600px; border-top: 5px solid var(--danger); padding: 0; overflow: hidden;">
                    <div style="padding: 1.5rem 2rem; background: #fff; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center;">
                        <h2 style="font-family:Outfit; margin:0; font-size:1.3rem"><i class="ph ph-chat-circle-dots text-danger"></i> Support Center</h2>
                        <button class="close-btn" onclick="Support.toggleModal(false)" style="position:static; font-size:1.5rem"><i class="ph ph-x"></i></button>
                    </div>

                    <!-- Tabs Header -->
                    <div style="display: flex; background: #f8fafc; border-bottom: 1px solid #f1f5f9;">
                        <button id="tabNewTicket" onclick="Support.switchTab('new')" style="flex:1; padding: 12px; border:none; background:white; font-weight:600; color:var(--primary); border-bottom: 2px solid var(--primary); cursor:pointer;">New Ticket</button>
                        <button id="tabTicketHistory" onclick="Support.switchTab('history')" style="flex:1; padding: 12px; border:none; background:transparent; font-weight:600; color:#64748b; cursor:pointer;">My History</button>
                    </div>

                    <div style="padding: 2rem;">
                        <!-- New Ticket Pane -->
                        <div id="paneNewTicket">
                            <p class="text-muted mb-4" style="font-size: 0.85rem;">Tell us about the issue, and we'll resolve it as quickly as possible.</p>
                            <form id="globalComplaintForm">
                                <div class="form-group mb-3">
                                    <label style="font-size: 0.75rem; font-weight: 700; color:#475569">ISSUE CATEGORY</label>
                                    <select id="gComplaintCategory" class="form-control" style="width: 100%; padding: 0.75rem; border-radius: 8px; border: 1.5px solid #e2e8f0;">
                                        <option value="Taxi Service">Taxi Service</option>
                                        <option value="Hotel/Resort Stay">Hotel/Resort Stay</option>
                                        <option value="Food Order">Food Order</option>
                                        <option value="Payment Issue">Payment Issue</option>
                                        <option value="App Bug/Feedback">App Bug/Feedback</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                                <div class="form-group mb-3">
                                    <label style="font-size: 0.75rem; font-weight: 700; color:#475569">SUBJECT</label>
                                    <input type="text" id="gComplaintSubject" placeholder="Briefly describe the issue" class="form-control" required style="width: 100%; padding: 0.75rem; border-radius: 8px; border: 1.5px solid #e2e8f0;">
                                </div>
                                <div class="form-group mb-4">
                                    <label style="font-size: 0.75rem; font-weight: 700; color:#475569">DETAILED DESCRIPTION</label>
                                    <textarea id="gComplaintMessage" rows="4" placeholder="Please provide details..." class="form-control" required style="width: 100%; padding: 0.75rem; border-radius: 8px; border: 1.5px solid #e2e8f0;"></textarea>
                                </div>
                                <button type="submit" class="btn btn-primary btn-full" id="gSubmitComplaintBtn">
                                    <i class="ph ph-paper-plane-tilt"></i> Submit Complaint
                                </button>
                            </form>
                        </div>

                        <!-- History Pane -->
                        <div id="paneTicketHistory" class="hidden">
                            <div id="gTicketList" style="max-height: 400px; overflow-y: auto;">
                                <div class="text-center py-4">
                                    <span class="spinner"></span> Loading history...
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);

        const form = document.getElementById('globalComplaintForm');
        if (form) {
            form.onsubmit = (e) => {
                e.preventDefault();
                this.submit();
            };
        }
    },

    toggleModal(show = true) {
        if (!Auth.isLoggedIn()) {
            Toast.show('Please sign in to raise a complaint', 'info');
            UI.toggleAuthModal(true);
            return;
        }
        const modal = document.getElementById('complaintModal');
        if (modal) {
            modal.classList.toggle('active', show);
            // Hide chat window if opening complaint modal
            if (show && ChatBot.isOpen) ChatBot.toggle();
        }
    },

    switchTab(tab) {
        const isNew = tab === 'new';
        document.getElementById('paneNewTicket').classList.toggle('hidden', !isNew);
        document.getElementById('paneTicketHistory').classList.toggle('hidden', isNew);

        document.getElementById('tabNewTicket').style.background = isNew ? 'white' : 'transparent';
        document.getElementById('tabNewTicket').style.borderBottom = isNew ? '2px solid var(--primary)' : 'none';
        document.getElementById('tabNewTicket').style.color = isNew ? 'var(--primary)' : '#64748b';

        document.getElementById('tabTicketHistory').style.background = isNew ? 'transparent' : 'white';
        document.getElementById('tabTicketHistory').style.borderBottom = isNew ? 'none' : '2px solid var(--primary)';
        document.getElementById('tabTicketHistory').style.color = isNew ? '#64748b' : 'var(--primary)';

        if (!isNew) this.loadHistory();
    },

    async loadHistory() {
        const user = Auth.getUser();
        const list = document.getElementById('gTicketList');
        try {
            const res = await apiFetch(`/complaints/customer/${user.id}`);
            if (res.success) {
                list.innerHTML = res.complaints.length ? res.complaints.map(c => `
                    <div class="card p-3 mb-2" style="background: #fff; border: 1px solid #f1f5f9; box-shadow: none;">
                        <div class="flex justify-between items-start mb-1">
                            <div>
                                <h4 style="font-family:Outfit; margin:0; font-size:1rem">${c.subject}</h4>
                                <span class="text-muted" style="font-size:0.75rem">#${c.ticket_id} • ${new Date(c.created_at).toLocaleDateString()}</span>
                            </div>
                            <span class="badge ${c.status === 'pending' ? 'badge-yellow' : 'badge-green'}" style="font-size:0.65rem">${c.status.toUpperCase()}</span>
                        </div>
                        <p style="font-size:0.8rem; color:#64748b; margin-top:0.5rem" class="line-clamp-2">${c.message}</p>
                    </div>
                `).join('') : '<div class="text-center py-5"><h3 style="font-family:Outfit">No tickets yet</h3><p class="text-muted">You haven\'t raised any complaints.</p></div>';
            }
        } catch (err) {
            list.innerHTML = `<div class="text-danger p-3">Failed to load history: ${err.message}</div>`;
        }
    },

    async submit() {
        const btn = document.getElementById('gSubmitComplaintBtn');
        const user = Auth.getUser();
        const orig = btn.innerHTML;

        const payload = {
            customer_id: user.id,
            customer_name: user.name,
            customer_email: user.email,
            customer_phone: user.phone,
            category: document.getElementById('gComplaintCategory').value,
            subject: document.getElementById('gComplaintSubject').value,
            message: document.getElementById('gComplaintMessage').value
        };

        try {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner"></span> Submitting...';

            const res = await apiFetch('/complaints/raise', { method: 'POST', body: payload });

            if (res.success) {
                Toast.show(`Complaint #${res.ticketId} raised successfully! Check your email.`);
                document.getElementById('globalComplaintForm').reset();
                this.switchTab('history');
            }
        } catch (err) {
            Toast.show(err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = orig;
        }
    }
};

window.Support = Support;

// ─── Initialize on every page ───────────────────────────
document.addEventListener('deviceready', () => {
    console.log("Cordova Device Ready");
    if (window.cordova && cordova.plugins && cordova.plugins.notification) {
        cordova.plugins.notification.local.requestPermission((granted) => {
            console.log("Native Notification Permission:", granted);
        });
    }
}, false);

document.addEventListener('DOMContentLoaded', () => {
    Cart.init();

    UI.renderNavbar(false);
    
    // Crucial: Re-render cart after navbar is created to sync counts
    Cart.render();

    initAuthModal();

    // Start Interactivity
    UI.initInteractivity();

    // Start ChatBot
    ChatBot.init();

    // Start Support
    Support.init();

    // Start Premium Carousels
    if (window.initPremiumCarousel) initPremiumCarousel();
    if (window.initDesktopCarousel) initDesktopCarousel();

    if (Auth.isLoggedIn()) {
        UI.updateMobileDashboard();
        setInterval(() => UI.updateMobileDashboard(), 30000); // Refresh widgets every 30s
        
        if (!window.cordova && Notification.permission === "default") {
            Notification.requestPermission();
        }
    } else if (sessionStorage.getItem('auth_redirect')) {
        // Auto-open modal if user was redirected here for auth
        setTimeout(() => UI.toggleAuthModal(true), 500);
    }
});



// --- PREMIUM CAROUSEL LOGIC ---------------------------
let slideIndex = 0;
let carouselTimer;

function initPremiumCarousel() {
    const slides = document.querySelectorAll("#premiumCarousel .carousel-slide");
    if (!slides.length) return;
    showSlides();
}

function showSlides() {
    let slides = document.querySelectorAll("#premiumCarousel .carousel-slide");
    let dots = document.querySelectorAll("#carouselDots .dot");
    if (!slides.length) return;

    for (let i = 0; i < slides.length; i++) {
        slides[i].classList.remove("active");
    }
    slideIndex++;
    if (slideIndex > slides.length) { slideIndex = 1 }
    for (let i = 0; i < dots.length; i++) {
        if (dots[i]) dots[i].classList.remove("active");
    }
    slides[slideIndex - 1].classList.add("active");
    if (dots[slideIndex - 1]) dots[slideIndex - 1].classList.add("active");
    
    clearTimeout(carouselTimer);
    carouselTimer = setTimeout(showSlides, 5000);
}

window.moveCarousel = function(n) {
    let slides = document.querySelectorAll("#premiumCarousel .carousel-slide");
    let dots = document.querySelectorAll("#carouselDots .dot");
    if (!slides.length) return;

    slideIndex += n - 1; 
    if (slideIndex >= slides.length) { slideIndex = 0; }
    if (slideIndex < 0) { slideIndex = slides.length - 1; }
    
    for (let i = 0; i < slides.length; i++) {
        slides[i].classList.remove("active");
        if (dots[i]) dots[i].classList.remove("active");
    }
    
    slides[slideIndex].classList.add("active");
    if (dots[slideIndex]) dots[slideIndex].classList.add("active");
    
    slideIndex++; 
    clearTimeout(carouselTimer);
    carouselTimer = setTimeout(showSlides, 5000);
};

window.currentSlide = function(n) {
    slideIndex = n;
    window.moveCarousel(0);
};

window.initPremiumCarousel = initPremiumCarousel;


// --- DESKTOP CAROUSEL LOGIC ---------------------------
let desktopSlideIndex = 0;
let desktopCarouselTimer;

function initDesktopCarousel() {
    const slides = document.querySelectorAll("#premiumCarouselDesktop .carousel-slide");
    if (!slides.length) return;
    showDesktopSlides();
}

function showDesktopSlides() {
    let slides = document.querySelectorAll("#premiumCarouselDesktop .carousel-slide");
    let dots = document.querySelectorAll("#carouselDotsDesktop .dot");
    if (!slides.length) return;

    for (let i = 0; i < slides.length; i++) {
        slides[i].classList.remove("active");
    }
    desktopSlideIndex++;
    if (desktopSlideIndex > slides.length) { desktopSlideIndex = 1 }
    for (let i = 0; i < dots.length; i++) {
        if (dots[i]) dots[i].classList.remove("active");
    }
    slides[desktopSlideIndex - 1].classList.add("active");
    if (dots[desktopSlideIndex - 1]) dots[desktopSlideIndex - 1].classList.add("active");
    
    clearTimeout(desktopCarouselTimer);
    desktopCarouselTimer = setTimeout(showDesktopSlides, 6000); // 6s for desktop
}

window.moveCarouselDesktop = function(n) {
    let slides = document.querySelectorAll("#premiumCarouselDesktop .carousel-slide");
    let dots = document.querySelectorAll("#carouselDotsDesktop .dot");
    if (!slides.length) return;

    desktopSlideIndex += n - 1; 
    if (desktopSlideIndex >= slides.length) { desktopSlideIndex = 0; }
    if (desktopSlideIndex < 0) { desktopSlideIndex = slides.length - 1; }
    
    for (let i = 0; i < slides.length; i++) {
        slides[i].classList.remove("active");
        if (dots[i]) dots[i].classList.remove("active");
    }
    
    slides[desktopSlideIndex].classList.add("active");
    if (dots[desktopSlideIndex]) dots[desktopSlideIndex].classList.add("active");
    
    desktopSlideIndex++; 
    clearTimeout(desktopCarouselTimer);
    desktopCarouselTimer = setTimeout(showDesktopSlides, 6000);
};

window.currentSlideDesktop = function(n) {
    desktopSlideIndex = n;
    window.moveCarouselDesktop(0);
};

window.initDesktopCarousel = initDesktopCarousel;
