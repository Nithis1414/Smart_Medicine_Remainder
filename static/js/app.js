/**
 * Medicine Reminder System – Main Application JavaScript
 * Handles theme toggling, sidebar, medicine CRUD, reminders,
 * voice synthesis, prescriptions, search/filter, and chatbot.
 */

// ──────────────────────────────────────────────
// Theme Toggle
// ──────────────────────────────────────────────
function initTheme() {
    const saved = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    updateThemeIcon(saved);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    updateThemeIcon(next);
}

function updateThemeIcon(theme) {
    const btn = document.getElementById('themeToggle');
    if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
}

// ──────────────────────────────────────────────
// Sidebar Toggle (Mobile)
// ──────────────────────────────────────────────
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) sidebar.classList.toggle('open');
}

// ──────────────────────────────────────────────
// Flash Messages Auto-dismiss
// ──────────────────────────────────────────────
function initAlerts() {
    document.querySelectorAll('.alert').forEach(alert => {
        setTimeout(() => {
            alert.style.opacity = '0';
            alert.style.transform = 'translateY(-10px)';
            setTimeout(() => alert.remove(), 300);
        }, 4000);
    });
}

// ──────────────────────────────────────────────
// Medicine Management
// ──────────────────────────────────────────────
function openAddMedicineModal() {
    document.getElementById('medicineModalTitle').textContent = 'Add Medicine';
    document.getElementById('medicineForm').reset();
    document.getElementById('medicineId').value = '';
    if (window.medTimePicker) window.medTimePicker.clear();
    document.getElementById('medicineModal').classList.add('active');
}

function openEditMedicineModal(id) {
    fetch(`/api/medicines`)
        .then(r => r.json())
        .then(medicines => {
            const med = medicines.find(m => m.id === id);
            if (!med) return;
            document.getElementById('medicineModalTitle').textContent = 'Edit Medicine';
            document.getElementById('medicineId').value = med.id;
            document.getElementById('medName').value = med.name;
            document.getElementById('medDosage').value = med.dosage;
            document.getElementById('medFrequency').value = med.frequency;
            if (window.medTimePicker) {
                window.medTimePicker.setDate(med.reminder_time);
            } else {
                document.getElementById('medTime').value = med.reminder_time;
            }
            document.getElementById('medStartDate').value = med.start_date;
            document.getElementById('medEndDate').value = med.end_date || '';
            document.getElementById('medNotes').value = med.notes || '';
            document.getElementById('medicineModal').classList.add('active');
        });
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

function saveMedicine(e) {
    e.preventDefault();
    const id = document.getElementById('medicineId').value;
    const data = {
        name: document.getElementById('medName').value,
        dosage: document.getElementById('medDosage').value,
        frequency: document.getElementById('medFrequency').value,
        reminder_time: document.getElementById('medTime').value,
        start_date: document.getElementById('medStartDate').value,
        end_date: document.getElementById('medEndDate').value,
        notes: document.getElementById('medNotes').value
    };

    const url = id ? `/api/medicines/${id}` : '/api/medicines';
    const method = id ? 'PUT' : 'POST';

    fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
    .then(r => r.json())
    .then(result => {
        if (result.error) { showToast(result.error, 'error'); return; }
        showToast(id ? 'Medicine updated!' : 'Medicine added!', 'success');
        closeModal('medicineModal');
        setTimeout(() => location.reload(), 500);
    })
    .catch(() => showToast('Something went wrong.', 'error'));
}

function deleteMedicine(id) {
    if (!confirm('Are you sure you want to delete this medicine?')) return;
    fetch(`/api/medicines/${id}`, { method: 'DELETE' })
        .then(r => r.json())
        .then(() => {
            showToast('Medicine deleted.', 'success');
            setTimeout(() => location.reload(), 500);
        });
}

function takeMedicine(id) {
    fetch(`/api/medicines/${id}/take`, { method: 'POST' })
        .then(r => r.json())
        .then(() => {
            showToast('Marked as taken! ✅', 'success');
            setTimeout(() => location.reload(), 500);
        });
}

function skipMedicine(id) {
    fetch(`/api/medicines/${id}/skip`, { method: 'POST' })
        .then(r => r.json())
        .then(() => {
            showToast('Medicine skipped.', 'warning');
            setTimeout(() => location.reload(), 500);
        });
}

// ──────────────────────────────────────────────
// Search / Filter Medicines
// ──────────────────────────────────────────────
function filterMedicines(query) {
    const items = document.querySelectorAll('.medicine-item');
    const q = query.toLowerCase();
    items.forEach(item => {
        const name = item.querySelector('.med-name')?.textContent.toLowerCase() || '';
        const detail = item.querySelector('.med-detail')?.textContent.toLowerCase() || '';
        item.style.display = (name.includes(q) || detail.includes(q)) ? '' : 'none';
    });
}

// ──────────────────────────────────────────────
// Prescription Upload
// ──────────────────────────────────────────────
function openPrescriptionModal() {
    document.getElementById('prescriptionForm').reset();
    document.getElementById('prescriptionModal').classList.add('active');
}

function uploadPrescription(e) {
    e.preventDefault();
    const form = document.getElementById('prescriptionForm');
    const formData = new FormData(form);

    fetch('/api/prescriptions', { method: 'POST', body: formData })
        .then(r => r.json())
        .then(result => {
            if (result.error) { showToast(result.error, 'error'); return; }
            showToast('Prescription uploaded!', 'success');
            closeModal('prescriptionModal');
            setTimeout(() => location.reload(), 500);
        })
        .catch(() => showToast('Upload failed.', 'error'));
}

function deletePrescription(id) {
    if (!confirm('Delete this prescription?')) return;
    fetch(`/api/prescriptions/${id}`, { method: 'DELETE' })
        .then(r => r.json())
        .then(() => {
            showToast('Prescription deleted.', 'success');
            setTimeout(() => location.reload(), 500);
        });
}

// ──────────────────────────────────────────────
// Voice Reminder (SpeechSynthesis API)
// ──────────────────────────────────────────────
function speakReminder(medicineName) {
    if (!('speechSynthesis' in window)) return;
    const msg = new SpeechSynthesisUtterance(
        `Time to take your medicine. Please take ${medicineName} now.`
    );
    msg.rate = 0.9;
    msg.pitch = 1;
    msg.volume = 1;
    speechSynthesis.speak(msg);
}

// ──────────────────────────────────────────────
// Password Toggle
// ──────────────────────────────────────────────
function togglePassword(inputId, iconElement) {
    const input = document.getElementById(inputId);
    if (input.type === 'password') {
        input.type = 'text';
        iconElement.textContent = '🙈';
    } else {
        input.type = 'password';
        iconElement.textContent = '👁️';
    }
}

// ──────────────────────────────────────────────
// Reminder System
// ──────────────────────────────────────────────
let reminderInterval = null;

function getReminderTimes(startTimeStr, frequency) {
    if (!startTimeStr) return [];
    if (frequency === 'As needed') return [];
    
    let times = [startTimeStr];
    let parts = startTimeStr.split(':');
    if (parts.length !== 2) return times;
    
    let h = parseInt(parts[0], 10);
    let m = parseInt(parts[1], 10);
    
    const addHours = (hours) => {
        let newH = (h + hours) % 24;
        return `${newH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };

    if (frequency === 'Twice daily') {
        times.push(addHours(12));
    } else if (frequency === 'Three times daily') {
        times.push(addHours(8));
        times.push(addHours(16));
    } else if (frequency === 'Every 4 hours') {
        for(let i=4; i<24; i+=4) times.push(addHours(i));
    } else if (frequency === 'Every 6 hours') {
        for(let i=6; i<24; i+=6) times.push(addHours(i));
    } else if (frequency === 'Every 8 hours') {
        for(let i=8; i<24; i+=8) times.push(addHours(i));
    }
    
    return times;
}

function startReminderSystem() {
    // Check every 30 seconds
    checkReminders();
    reminderInterval = setInterval(checkReminders, 30000);
}

function checkReminders() {
    fetch('/api/medicines')
        .then(r => r.json())
        .then(medicines => {
            const now = new Date();
            const currentTime = now.toTimeString().substring(0, 5); // HH:MM
            const today = now.toISOString().split('T')[0];

            medicines.forEach(med => {
                if (!med.is_active) return;
                if (med.start_date > today) return;
                if (med.end_date && med.end_date < today) return;
                
                const times = getReminderTimes(med.reminder_time, med.frequency);
                if (times.includes(currentTime)) {
                    showReminderPopup(med);
                }
            });
        })
        .catch(() => {});
}

function showReminderPopup(medicine) {
    // Prevent duplicate popups
    const existingKey = `reminder_${medicine.id}_${new Date().toTimeString().substring(0, 5)}`;
    if (sessionStorage.getItem(existingKey)) return;
    sessionStorage.setItem(existingKey, '1');

    const popup = document.getElementById('reminderPopup');
    if (!popup) return;

    document.getElementById('reminderMedName').textContent = medicine.name;
    document.getElementById('reminderMedDosage').textContent = `Dosage: ${medicine.dosage}`;
    popup.setAttribute('data-med-id', medicine.id);
    popup.classList.add('show');

    // Play voice reminder
    speakReminder(medicine.name);

    // Play notification sound
    playNotificationSound();

    // Auto-hide after 60 seconds
    setTimeout(() => popup.classList.remove('show'), 60000);
}

function handleReminderTake() {
    const popup = document.getElementById('reminderPopup');
    const medId = popup.getAttribute('data-med-id');
    takeMedicine(parseInt(medId));
    popup.classList.remove('show');
}

function handleReminderSkip() {
    const popup = document.getElementById('reminderPopup');
    const medId = popup.getAttribute('data-med-id');
    skipMedicine(parseInt(medId));
    popup.classList.remove('show');
}

function dismissReminder() {
    document.getElementById('reminderPopup')?.classList.remove('show');
}

// ──────────────────────────────────────────────
// Notification Sound
// ──────────────────────────────────────────────
function playNotificationSound() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = freq;
            osc.type = 'sine';
            gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.2);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.2 + 0.4);
            osc.start(ctx.currentTime + i * 0.2);
            osc.stop(ctx.currentTime + i * 0.2 + 0.4);
        });
    } catch (e) {}
}

// ──────────────────────────────────────────────
// Toast Notifications
// ──────────────────────────────────────────────
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `alert alert-${type}`;
    toast.style.cssText = 'position:fixed;top:1rem;right:1rem;z-index:400;min-width:280px;max-width:400px;';
    toast.innerHTML = `${type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'} ${message}`;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ──────────────────────────────────────────────
// Chatbot
// ──────────────────────────────────────────────
function initChatbot() {
    const input = document.getElementById('chatInput');
    if (!input) return;
    input.addEventListener('keypress', e => {
        if (e.key === 'Enter') sendChatMessage();
    });
}

function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    if (!message) return;

    appendChatBubble(message, 'user');
    input.value = '';
    showTypingIndicator();

    fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ message })
    })
    .then(async r => {
        if (!r.ok) {
            if (r.status === 401) {
                showSessionExpiredBanner('Your session has expired. Redirecting to login...');
                setTimeout(() => { window.location.href = '/login'; }, 3000);
                throw new Error('Session expired. Redirecting to login.');
            }

            const text = await r.text();
            try {
                const err = JSON.parse(text);
                throw new Error(err.error || err.response || 'Server error');
            } catch {
                throw new Error(text || 'Server error. Please try again.');
            }
        }
        return r.json();
    })
    .then(data => {
        hideTypingIndicator();
        appendChatBubble(data.response || 'Sorry, I could not process that.', 'bot');
    })
    .catch(err => {
        console.error('Chat Error:', err);
        hideTypingIndicator();
        const msg = err.message.includes('disclaimer') ? 'Unable to connect to AI service' : err.message;
        appendChatBubble(`Error: ${msg}`, 'bot');
    });
}

function appendChatBubble(text, type) {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${type}`;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    bubble.innerHTML = `<div>${text}</div><div class="timestamp">${time}</div>`;
    container.appendChild(bubble);
    container.scrollTop = container.scrollHeight;
}

function showTypingIndicator() {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.id = 'typingIndicator';
    indicator.innerHTML = '<span></span><span></span><span></span>';
    container.appendChild(indicator);
    container.scrollTop = container.scrollHeight;
}

function hideTypingIndicator() {
    document.getElementById('typingIndicator')?.remove();
}

function showSessionExpiredBanner(message) {
    const banner = document.getElementById('sessionExpiredBanner');
    if (!banner) return;
    banner.textContent = `⚠️ ${message}`;
    banner.style.display = 'block';
}

// ──────────────────────────────────────────────
// Pharmacy Map (Leaflet + OpenStreetMap)
// ──────────────────────────────────────────────
let pharmacyMap = null;

function initPharmacyMap() {
    if (!document.getElementById('pharmacy-map')) return;

    // Fix default Leaflet icon paths
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png'
    });

    pharmacyMap = L.map('pharmacy-map').setView([20.5937, 78.9629], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(pharmacyMap);

    // Ensure map renders correctly inside its container
    setTimeout(() => {
        pharmacyMap.invalidateSize();
    }, 200);

    locateUser();
}

function locateUser() {
    if (!navigator.geolocation) {
        showToast('Geolocation is not supported.', 'warning');
        return;
    }
    
    showToast('Finding your location...', 'info');
    
    navigator.geolocation.getCurrentPosition(
        pos => {
            const { latitude, longitude, accuracy } = pos.coords;
            
            // Clear existing markers except user
            if (pharmacyMap) {
                pharmacyMap.eachLayer(layer => {
                    if (layer instanceof L.Marker || layer instanceof L.Circle) {
                        pharmacyMap.removeLayer(layer);
                    }
                });
            }

            pharmacyMap.setView([latitude, longitude], 14);
            
            // User marker
            L.marker([latitude, longitude])
                .addTo(pharmacyMap)
                .bindPopup(`<b>📍 You are here</b><br><small>Accuracy: ${Math.round(accuracy)}m</small>`)
                .openPopup();
            
            // Draw search radius (5km)
            L.circle([latitude, longitude], {
                radius: 5000,
                color: 'var(--primary)',
                fillColor: 'var(--primary)',
                fillOpacity: 0.1,
                weight: 1
            }).addTo(pharmacyMap);

            searchNearbyPharmacies(latitude, longitude);
        },
        err => {
            console.error('Geolocation error:', err);
            let msg = 'Location access denied.';
            if (err.code === 1) msg = 'Location permission denied.';
            else if (err.code === 2) msg = 'Location unavailable.';
            else if (err.code === 3) msg = 'Location timeout.';
            
            showToast(`${msg} Showing default location.`, 'warning');
            searchNearbyPharmacies(20.5937, 78.9629); 
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
}

function searchNearbyPharmacies(lat, lon) {
    const list = document.getElementById('pharmacyList');
    if (list) list.innerHTML = '<div style="padding:2rem;text-align:center"><div class="typing-indicator" style="display:inline-flex"><span></span><span></span><span></span></div><p>Searching pharmacies...</p></div>';

    const query = `[out:json];(node["amenity"="pharmacy"](around:5000,${lat},${lon});node["shop"="chemist"](around:5000,${lat},${lon}););out body;`;
    const overpassUrl = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

    fetch(overpassUrl)
        .then(r => r.json())
        .then(data => {
            const pharmacyIcon = L.icon({
                iconUrl: 'https://cdn.jsdelivr.net/gh/pointhi/leaflet-color-markers@master/img/marker-icon-2x-green.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
                iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34]
            });

            if (list) list.innerHTML = '';

            if (data.elements.length === 0) {
                if (list) list.innerHTML = '<p style="padding:2rem;text-align:center;color:var(--text-light)">No pharmacies found within 5km.</p>';
                return;
            }

            // Calculate distance for sorting
            const results = data.elements.map(el => {
                const dist = calculateDistance(lat, lon, el.lat, el.lon);
                return { ...el, distance: dist };
            }).sort((a, b) => a.distance - b.distance);

            results.forEach(el => {
                const name = el.tags?.name || 'Pharmacy';
                const addr = el.tags?.['addr:street'] || el.tags?.['addr:full'] || 'Address not available';
                const phone = el.tags?.phone || '';
                const distStr = el.distance < 1 ? `${(el.distance * 1000).toFixed(0)}m` : `${el.distance.toFixed(1)}km`;

                L.marker([el.lat, el.lon], { icon: pharmacyIcon })
                    .addTo(pharmacyMap)
                    .bindPopup(`<b>🏥 ${name}</b><br>${addr}<br>${phone ? '📞 '+phone : ''}<br><b>📏 ${distStr} away</b>`);

                if (list) {
                    const item = document.createElement('div');
                    item.className = 'medicine-item';
                    item.style.cursor = 'pointer';
                    item.onclick = () => {
                        pharmacyMap.setView([el.lat, el.lon], 16);
                        L.popup()
                            .setLatLng([el.lat, el.lon])
                            .setContent(`<b>🏥 ${name}</b><br>${distStr} away`)
                            .openOn(pharmacyMap);
                    };
                    item.innerHTML = `
                        <div class="med-info">
                            <div class="med-icon" style="background:rgba(16,185,129,.1);color:var(--success)">🏥</div>
                            <div>
                                <div class="med-name">${name}</div>
                                <div class="med-detail">${distStr} • ${addr}</div>
                            </div>
                        </div>
                        <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation();getDirections(${el.lat},${el.lon})">📍 Directions</button>
                    `;
                    list.appendChild(item);
                }
            });
            showToast(`Found ${data.elements.length} pharmacies nearby.`, 'success');
        })
        .catch(() => {
            if (list) list.innerHTML = '<p style="padding:2rem;text-align:center;color:var(--danger)">Error loading pharmacies. Please try again.</p>';
            showToast('Could not load pharmacies.', 'error');
        });
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function searchPharmacyByArea() {
    const input = document.getElementById('pharmacySearch');
    if (!input || !input.value.trim()) return;

    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(input.value)}`)
        .then(r => r.json())
        .then(results => {
            if (results.length > 0) {
                const { lat, lon } = results[0];
                pharmacyMap.setView([parseFloat(lat), parseFloat(lon)], 14);
                searchNearbyPharmacies(parseFloat(lat), parseFloat(lon));
            } else {
                showToast('Location not found.', 'warning');
            }
        });
}

function getDirections(lat, lon) {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`, '_blank');
}

// ──────────────────────────────────────────────
// Initialization
// ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initAlerts();
    initChatbot();
    initPharmacyMap();

    // Start reminder checking if on dashboard
    if (document.querySelector('.stats-grid')) {
        startReminderSystem();
    }

    // Close modals on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', e => {
            if (e.target === overlay) overlay.classList.remove('active');
        });
    });
});
