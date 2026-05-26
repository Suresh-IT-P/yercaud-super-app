// --- Optimized 3D Flying Hills Animation ---
const canvas = document.getElementById('polyCanvas');
const ctx = canvas.getContext('2d');

let width, height;
let time = 0;

// Optimized Grid configuration
let cols, rows, scale;
let verticalGradient;

function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    
    // Dynamically scale resolution based on device for performance
    if (width < 768) {
        cols = 16;
        rows = 25;
        scale = 90;
    } else {
        cols = 35;
        rows = 35;
        scale = 80;
    }
    
    // Pre-calculate gradient for vertical lines (HUGE performance boost)
    // instead of creating it 60 times a second
    verticalGradient = ctx.createLinearGradient(width/2, height, width/2, height/2 - 150);
    verticalGradient.addColorStop(0, 'rgba(34, 197, 94, 0.4)');
    verticalGradient.addColorStop(1, 'rgba(34, 197, 94, 0)');
}

function animate() {
    ctx.clearRect(0, 0, width, height);
    time -= 0.03; // Smooth fly speed
    
    const fov = width * 0.8;
    const cameraZ = 250;
    const startX = - (cols * scale) / 2;
    
    // 1. Draw Horizontal Lines (Rows)
    for (let y = 0; y < rows - 1; y++) {
        let z3d = y * scale;
        const opacity = 1 - (y / (rows - 5));
        
        // Performance skip: don't render invisible distant lines
        if (opacity <= 0) continue; 
        
        ctx.beginPath();
        let yOff = time + (y * 0.15);
        
        for (let x = 0; x < cols; x++) {
            let x3d = startX + x * scale;
            let xOff = x * 0.15;
            
            // Calculate height on the fly (saves memory/loops)
            let y3d = Math.sin(xOff) * Math.cos(yOff) * 140 + Math.sin(xOff * 0.4) * 70;
            
            // Project 3D to 2D Screen Space
            let z = z3d + cameraZ;
            let scaleFactor = fov / z;
            let xProj = (x3d * scaleFactor) + (width / 2);
            let yProj = ((y3d + 200) * scaleFactor) + (height / 2.2);
            
            if (x === 0) ctx.moveTo(xProj, yProj);
            else ctx.lineTo(xProj, yProj);
        }
        ctx.strokeStyle = `rgba(34, 197, 94, ${opacity * 0.6})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();
    }
    
    // 2. Draw Vertical Lines (Columns) - Batched into a single stroke!
    ctx.beginPath();
    for (let x = 0; x < cols; x++) {
        let x3d = startX + x * scale;
        let xOff = x * 0.15;
        
        for (let y = 0; y < rows - 1; y++) {
            let z3d = y * scale;
            if (1 - (y / (rows - 5)) <= 0) break; // Performance skip
            
            let yOff = time + (y * 0.15);
            let y3d = Math.sin(xOff) * Math.cos(yOff) * 140 + Math.sin(xOff * 0.4) * 70;
            
            let z = z3d + cameraZ;
            let scaleFactor = fov / z;
            let xProj = (x3d * scaleFactor) + (width / 2);
            let yProj = ((y3d + 200) * scaleFactor) + (height / 2.2);
            
            if (y === 0) ctx.moveTo(xProj, yProj);
            else ctx.lineTo(xProj, yProj);
        }
    }
    // Apply pre-calculated gradient and execute a single stroke for all columns
    ctx.strokeStyle = verticalGradient;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    
    requestAnimationFrame(animate);
}

function initAnimation() {
    resize();
    window.addEventListener('resize', resize);
    animate();
}

// Start animation
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
