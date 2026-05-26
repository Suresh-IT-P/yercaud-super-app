// --- Ultra-Optimized 3D Flying Hills Animation ---
const canvas = document.getElementById('polyCanvas');
const ctx = canvas.getContext('2d', { alpha: false });

let width, height, canvasW, canvasH;
let time = 0;
let cols, rows, scale;
let verticalGradient;
let isVisible = true;
let lastFrame = 0;
const FPS_INTERVAL = 1000 / 30; // Cap at 30fps — smooth enough for a background

// Pre-compute sin/cos lookup table (eliminates ~2000 Math calls per frame)
const LUT_SIZE = 1024;
const sinLUT = new Float32Array(LUT_SIZE);
const cosLUT = new Float32Array(LUT_SIZE);
for (let i = 0; i < LUT_SIZE; i++) {
    const angle = (i / LUT_SIZE) * Math.PI * 8; // covers 0..8π range
    sinLUT[i] = Math.sin(angle);
    cosLUT[i] = Math.cos(angle);
}
function fastSin(v) {
    const idx = ((v % (Math.PI * 8)) + Math.PI * 8) / (Math.PI * 8) * LUT_SIZE;
    return sinLUT[((idx | 0) % LUT_SIZE + LUT_SIZE) % LUT_SIZE];
}
function fastCos(v) {
    const idx = ((v % (Math.PI * 8)) + Math.PI * 8) / (Math.PI * 8) * LUT_SIZE;
    return cosLUT[((idx | 0) % LUT_SIZE + LUT_SIZE) % LUT_SIZE];
}

// Pause when tab is hidden
document.addEventListener('visibilitychange', () => { isVisible = !document.hidden; });

// Debounced resize
let resizeTimer;
function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150);
}

function resize() {
    // Render at half resolution for massive GPU savings, CSS scales it up
    const dpr = Math.min(window.devicePixelRatio || 1, 1); // cap at 1x
    width = window.innerWidth;
    height = window.innerHeight;
    canvasW = canvas.width = Math.round(width * 0.5);  // half-res buffer
    canvasH = canvas.height = Math.round(height * 0.5);
    canvas.style.width = width + 'px';   // stretch to full viewport
    canvas.style.height = height + 'px';
    ctx.setTransform(0.5, 0, 0, 0.5, 0, 0);

    if (width < 768) {
        cols = 12; rows = 18; scale = 100;
    } else {
        cols = 22; rows = 22; scale = 90;
    }

    verticalGradient = ctx.createLinearGradient(width / 2, height, width / 2, height / 2 - 150);
    verticalGradient.addColorStop(0, 'rgba(226, 176, 74, 0.3)');
    verticalGradient.addColorStop(1, 'rgba(226, 176, 74, 0)');
}

// Pre-allocate row opacity array
let rowOpacities;
function precalcOpacities() {
    rowOpacities = new Float32Array(rows);
    for (let y = 0; y < rows; y++) {
        rowOpacities[y] = Math.max(0, 1 - y / (rows - 4));
    }
}

function animate(timestamp) {
    requestAnimationFrame(animate);

    // Skip if tab hidden
    if (!isVisible) return;

    // Throttle to 30fps
    const delta = timestamp - lastFrame;
    if (delta < FPS_INTERVAL) return;
    lastFrame = timestamp - (delta % FPS_INTERVAL);

    // Clear with dark fill (faster than clearRect on opaque canvas)
    ctx.fillStyle = '#0d0d0d';
    ctx.fillRect(0, 0, width, height);

    time -= 0.025;
    const fov = width * 0.8;
    const cameraZ = 250;
    const startX = -(cols * scale) / 2;
    const halfW = width / 2;
    const baseY = height / 2.2;

    // 1. Horizontal lines — one beginPath per row
    ctx.lineWidth = 1;
    for (let y = 0; y < rows - 1; y++) {
        const op = rowOpacities[y];
        if (op <= 0) continue;

        const z3d = y * scale;
        const yOff = time + y * 0.15;
        const z = z3d + cameraZ;
        const sf = fov / z;

        ctx.beginPath();
        for (let x = 0; x < cols; x++) {
            const x3d = startX + x * scale;
            const xOff = x * 0.15;
            const h = fastSin(xOff) * fastCos(yOff) * 140 + fastSin(xOff * 0.4) * 70;
            const px = x3d * sf + halfW;
            const py = (h + 200) * sf + baseY;
            x === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.strokeStyle = `rgba(226,176,74,${(op * 0.45).toFixed(2)})`;
        ctx.stroke();
    }

    // 2. Vertical lines — single batched stroke
    ctx.beginPath();
    for (let x = 0; x < cols; x++) {
        const x3d = startX + x * scale;
        const xOff = x * 0.15;
        const sinX = fastSin(xOff);
        const sinX4 = fastSin(xOff * 0.4) * 70;

        for (let y = 0; y < rows - 1; y++) {
            if (rowOpacities[y] <= 0) break;
            const z = y * scale + cameraZ;
            const sf = fov / z;
            const h = sinX * fastCos(time + y * 0.15) * 140 + sinX4;
            const px = x3d * sf + halfW;
            const py = (h + 200) * sf + baseY;
            y === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
    }
    ctx.strokeStyle = verticalGradient;
    ctx.lineWidth = 1;
    ctx.stroke();
}

function initAnimation() {
    resize();
    precalcOpacities();
    window.addEventListener('resize', () => { onResize(); setTimeout(precalcOpacities, 200); });
    requestAnimationFrame(animate);
}

initAnimation();


// --- Navbar Scroll Effect ---
window.addEventListener('scroll', () => {
    const nav = document.getElementById('navbar');
    if (window.scrollY > 50) {
        nav.classList.add('scrolled');
    } else {
        nav.classList.remove('scrolled');
    }
});


// --- Modal & Booking Logic ---
const modal = document.getElementById('bookingModal');
const dynamicFields = document.getElementById('dynamicFields');
const modalTitle = document.getElementById('modalTitle');
const bookingTypeInput = document.getElementById('bookingType');

const formTemplates = {
    room: {
        title: 'Book a Stay',
        html: `
            <div class="form-group">
                <label>Room Type Preference</label>
                <select class="form-control" id="roomType" required>
                    <option value="Luxury Resort">Luxury Resort</option>
                    <option value="Cozy Homestay">Cozy Homestay</option>
                    <option value="Budget Hotel">Budget Hotel</option>
                </select>
            </div>
            <div class="form-group">
                <label>Check-in</label>
                <input type="date" class="form-control" id="checkIn" required>
            </div>
            <div class="form-group">
                <label>Check-out</label>
                <input type="date" class="form-control" id="checkOut" required>
            </div>
            <div class="form-group">
                <label>Number of Guests</label>
                <input type="number" class="form-control" id="guests" min="1" value="2" required>
            </div>
        `
    },
    taxi: {
        title: 'Hire a Cab',
        html: `
            <div class="form-group">
                <label>Service Type</label>
                <select class="form-control" id="serviceType" required>
                    <option value="Local Sightseeing">Local Sightseeing (20 Viewpoints)</option>
                    <option value="Airport Drop/Pickup">Airport Drop/Pickup</option>
                    <option value="Outstation">Outstation Trip</option>
                </select>
            </div>
            <div class="form-group">
                <label>Date</label>
                <input type="date" class="form-control" id="taxiDate" required>
            </div>
            <div class="form-group">
                <label>Pickup Location</label>
                <input type="text" class="form-control" id="pickup" required placeholder="E.g. Salem Junction">
            </div>
        `
    },

    trip: {
        title: 'Plan a Trip',
        html: `
            <div class="form-group">
                <label>Duration</label>
                <select class="form-control" id="duration" required>
                    <option value="Day Trip">Day Trip</option>
                    <option value="1N/2D">1 Night / 2 Days</option>
                    <option value="2N/3D">2 Nights / 3 Days</option>
                    <option value="Custom">Custom Duration</option>
                </select>
            </div>
            <div class="form-group">
                <label>Budget per person</label>
                <select class="form-control" id="budget" required>
                    <option value="Budget (< ₹2000)">Budget (< ₹2000)</option>
                    <option value="Standard (₹2000-₹5000)">Standard (₹2000-₹5000)</option>
                    <option value="Luxury (> ₹5000)">Luxury (> ₹5000)</option>
                </select>
            </div>
        `
    },
    proposal: {
        title: 'Plan a Love Proposal',
        html: `
            <div class="form-group">
                <label>Setup Preference</label>
                <select class="form-control" id="setupType" required>
                    <option value="Candlelight Dinner">Private Candlelight Dinner</option>
                    <option value="Viewpoint Setup">Scenic Viewpoint Setup</option>
                    <option value="Room Decoration">Romantic Room Decoration</option>
                </select>
            </div>
            <div class="form-group">
                <label>Target Date</label>
                <input type="date" class="form-control" id="eventDate" required>
            </div>
        `
    },
    anniversary: {
        title: 'Anniversary Celebration',
        html: `
            <div class="form-group">
                <label>Experience Type</label>
                <select class="form-control" id="setupType" required>
                    <option value="Couple Retreat">Couple Retreat Package</option>
                    <option value="Family Gathering">Family Anniversary Dinner</option>
                </select>
            </div>
            <div class="form-group">
                <label>Celebration Date</label>
                <input type="date" class="form-control" id="eventDate" required>
            </div>
        `
    },
    birthday: {
        title: 'Birthday Party Planner',
        html: `
            <div class="form-group">
                <label>Party Size</label>
                <select class="form-control" id="setupType" required>
                    <option value="Intimate (2-5)">Intimate Surprise (2-5 Guests)</option>
                    <option value="Small Group (6-15)">Small Group (6-15 Guests)</option>
                    <option value="Large Party (15+)">Large Party (15+ Guests)</option>
                </select>
            </div>
            <div class="form-group">
                <label>Party Date</label>
                <input type="date" class="form-control" id="eventDate" required>
            </div>
        `
    },
    custom: {
        title: 'Custom Service Request',
        html: `
            <div class="form-group">
                <label>What do you need?</label>
                <textarea class="form-control" id="customRequirement" placeholder="E.g., I want to hire a local guide for trekking, or I need help organizing a photoshoot..." style="min-height: 120px;" required></textarea>
            </div>
            <div class="form-group">
                <label>Tentative Date (Optional)</label>
                <input type="date" class="form-control" id="eventDate">
            </div>
        `
    }
};

function openModal(type) {
    bookingTypeInput.value = type;
    modalTitle.textContent = formTemplates[type].title;
    dynamicFields.innerHTML = formTemplates[type].html;
    modal.classList.add('active');
    
    // Reset base fields
    document.getElementById('name').value = '';
    document.getElementById('email').value = '';
    document.getElementById('phone').value = '';
    document.getElementById('notes').value = '';
}

function closeModal() {
    modal.classList.remove('active');
}

function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    
    if (isError) {
        toast.classList.add('error');
    } else {
        toast.classList.remove('error');
    }
    
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}

async function submitBooking(e) {
    e.preventDefault();
    
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.textContent = 'Sending...';
    submitBtn.disabled = true;
    
    const type = document.getElementById('bookingType').value;
    
    // Gather common data
    const data = {
        type,
        name: document.getElementById('name').value,
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value,
        details: {
            notes: document.getElementById('notes').value
        }
    };
    
    // Gather dynamic data based on type
    if (type === 'room') {
        data.details.roomType = document.getElementById('roomType').value;
        data.details.checkIn = document.getElementById('checkIn').value;
        data.details.checkOut = document.getElementById('checkOut').value;
        data.details.guests = document.getElementById('guests').value;
    } else if (type === 'taxi') {
        data.details.serviceType = document.getElementById('serviceType').value;
        data.details.dateTime = document.getElementById('taxiDate').value;
        data.details.pickup = document.getElementById('pickup').value;

    } else if (type === 'trip') {
        data.details.duration = document.getElementById('duration').value;
        data.details.budget = document.getElementById('budget').value;
    } else if (['proposal', 'anniversary', 'birthday'].includes(type)) {
        data.details.setupPreference = document.getElementById('setupType').value;
        data.details.date = document.getElementById('eventDate').value;
    } else if (type === 'custom') {
        data.details.requirement = document.getElementById('customRequirement').value;
        data.details.date = document.getElementById('eventDate').value;
    }
    
    try {
        const response = await fetch('/api/send-booking', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast('Booking request sent successfully!');
            closeModal();
        } else {
            showToast(result.error || 'Something went wrong', true);
        }
    } catch (err) {
        showToast('Network error. Please try again.', true);
        console.error(err);
    } finally {
        submitBtn.textContent = 'Send Request';
        submitBtn.disabled = false;
    }
}

// --- Hero Slideshow ---
document.addEventListener('DOMContentLoaded', () => {
    const slides = document.querySelectorAll('.hero-slide');
    if (slides.length > 0) {
        let currentSlide = 0;
        setInterval(() => {
            slides[currentSlide].classList.remove('active');
            currentSlide = (currentSlide + 1) % slides.length;
            slides[currentSlide].classList.add('active');
        }, 5000); // Change image every 5 seconds
    }
});
