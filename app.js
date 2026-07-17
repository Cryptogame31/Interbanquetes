// Interbanquetes - Application Logic & Firebase Compat Integration (Fase 2)

// ==========================================
// 1. CONFIGURACIÓN DE FIREBASE (Reemplazar con tus credenciales)
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyByzmFEAHN0KlOwZyIutt1gaLXqGaRPOWc",
  authDomain: "interbanquetes-9d00d.firebaseapp.com",
  projectId: "interbanquetes-9d00d",
  storageBucket: "interbanquetes-9d00d.firebasestorage.app",
  messagingSenderId: "36574803375",
  appId: "1:36574803375:web:976d8f0508ce68214f2b5a",
  measurementId: "G-9CZ5B2LQP2"
};

// Determinar si usar Firebase real o Simulación local
const useRealFirebase = (typeof firebase !== 'undefined' && firebaseConfig.apiKey && firebaseConfig.apiKey !== "REPLACE_WITH_YOUR_API_KEY");

let authInstance = null;
let firestoreDb = null;

if (useRealFirebase) {
    try {
        firebase.initializeApp(firebaseConfig);
        authInstance = firebase.auth();
        firestoreDb = firebase.firestore();
        console.log("🔥 Conectado con Firebase Live Database (Compat Mode)");
    } catch (err) {
        console.error("Error al inicializar Firebase. Corriendo en modo simulación local:", err);
    }
} else {
    console.log("⚙️ Ejecutando en Modo de Simulación Gremial (Sin Firebase). Configura las credenciales en app.js para conectar a producción.");
}

// ==========================================
// 2. MOCK DATA INITIAL SEED (Fallback local)
// ==========================================
const MOCK_INITIAL_SALONS = [
    {
        id: "yo",
        name: "Salón El Prado",
        owner: "Yo (Usuario)",
        username: "yo@interbanquetes.com",
        capacity: 200,
        address: "Calle de las Rosas #14-25, Sector Norte",
        prices: { friday: 1200000, saturday: 1500000, sunday: 950000, weekday: 700000 },
        inclusions: ["8 horas de alquiler", "Planta eléctrica de respaldo", "Mantenimiento en sitio", "Sonido básico ambiental", "Limpieza pre y post evento"],
        products: [
            { id: "prod_1", name: "Servicio de Vigilancia (2 guardias)", price: 150000 },
            { id: "prod_2", name: "Juego de Luces LED Neón", price: 200000 }
        ],
        bookings: [
            { date: "2026-11-07", eventName: "Boda de Sofía", guests: 120, clientName: "Sofía Martínez", clientPhone: "300 987 6543" },
            { date: "2026-11-14", eventName: "Cumpleaños Infantil", guests: 80, clientName: "Andrés Gomez", clientPhone: "315 555 1234" }
        ],
        authorized: true,
        role: "owner"
    },
    {
        id: "toni",
        name: "Toni's Events & Garden",
        owner: "Toni",
        username: "toni@interbanquetes.com",
        capacity: 350,
        address: "Av. General Belgrano #88, Zona Campestre",
        prices: { friday: 1800000, saturday: 2200000, sunday: 1400000, weekday: 1000000 },
        inclusions: ["Zona campestre y jardín", "10 horas de servicio", "Parqueadero privado", "Seguridad privada"],
        products: [{ id: "prod_4", name: "Carpa Gigante para Lluvia", price: 500000 }],
        bookings: [
            { date: "2026-11-14", eventName: "Matrimonio Campestre", guests: 200, clientName: "Patricia & Luis", clientPhone: "305 222 3333" },
            { date: "2026-11-29", eventName: "Almuerzo Familiar", guests: 50, clientName: "Toni (Propietario)", clientPhone: "300 000 0000" }
        ],
        authorized: true,
        role: "owner"
    },
    {
        id: "lina",
        name: "Lina's Palace",
        owner: "Lina",
        username: "lina@interbanquetes.com",
        capacity: 150,
        address: "Carrera 45 #10-80, El Poblado",
        prices: { friday: 1100000, saturday: 1300000, sunday: 900000, weekday: 650000 },
        inclusions: ["Aire acondicionado", "Sillas Tiffany", "Suite de descanso para novios"],
        products: [{ id: "prod_7", name: "Máquina de Humo y Luces", price: 120000 }],
        bookings: [
            { date: "2026-11-21", eventName: "Graduación Colegio", guests: 100, clientName: "Rectoría San José", clientPhone: "312 999 8888" },
            { date: "2026-11-29", eventName: "Boda de Gala", guests: 130, clientName: "Lina Palace Event", clientPhone: "314 777 6666" }
        ],
        authorized: true,
        role: "owner"
    }
];

// Mock auth users seed
const MOCK_INITIAL_USERS = {
    "yo@interbanquetes.com": { email: "yo@interbanquetes.com", password: "user123", salonId: "yo", role: "owner", authorized: true },
    "toni@interbanquetes.com": { email: "toni@interbanquetes.com", password: "toni123", salonId: "toni", role: "owner", authorized: true },
    "lina@interbanquetes.com": { email: "lina@interbanquetes.com", password: "lina123", salonId: "lina", role: "owner", authorized: true },
    "vendedor@demo.com": { email: "vendedor@demo.com", password: "vendedor123", salonId: "vendedor_demo", role: "seller", name: "Vendedor Gremial", authorized: true },
    "admin@interbanquetes.com": { email: "admin@interbanquetes.com", password: "admin123", salonId: null, role: "admin", authorized: true }
};

// ==========================================
// 3. STATE MANAGEMENT VARIABLES
// ==========================================
let salons = [];
let currentUser = null; // { uid, email, salonId, role, name, authorized }
let currentMonthDate = new Date(2026, 10, 1); // Defaults to November 2026
let selectedDateStr = "2026-11-29";
let activeTab = "calendar";
let unsubscribeSalons = null;

// ==========================================
// 4. AUTHENTICATION SERVICE WRAPPER
// ==========================================
const appAuth = {
    onAuthStateChanged: (callback) => {
        if (useRealFirebase) {
            authInstance.onAuthStateChanged(async (firebaseUser) => {
                if (firebaseUser) {
                    try {
                        if (firebaseUser.email === "admin@interbanquetes.com") {
                            currentUser = {
                                uid: firebaseUser.uid,
                                email: firebaseUser.email,
                                salonId: null,
                                role: "admin",
                                name: "Super Administrador",
                                authorized: true
                            };
                            callback(currentUser);
                            return;
                        }

                        const docRef = firestoreDb.collection("salons").doc(firebaseUser.uid);
                        const docSnap = await docRef.get();
                        
                        if (docSnap.exists) {
                            const salonData = docSnap.data();
                            currentUser = {
                                uid: firebaseUser.uid,
                                email: firebaseUser.email,
                                salonId: firebaseUser.uid,
                                role: salonData.role || "owner",
                                name: salonData.owner || "Miembro",
                                authorized: salonData.authorized === true
                            };
                            
                            if (!currentUser.authorized) {
                                console.warn("Usuario no autorizado todavía por el admin.");
                                callback(null, { status: "pending", salon: salonData });
                                return;
                            }
                            callback(currentUser);
                        } else {
                            console.error("Perfil de salón no encontrado en Firestore.");
                            await authInstance.signOut();
                            callback(null, { status: "error", message: "Perfil de salón no registrado en el gremio." });
                        }
                    } catch (err) {
                        console.error("Error al leer datos del usuario:", err);
                        callback(null, { status: "error", message: "Error al validar la sesión." });
                    }
                } else {
                    currentUser = null;
                    callback(null);
                }
            });
        } else {
            // Local storage simulation
            const activeUid = localStorage.getItem("interbanquetes_active_uid");
            const mockUsers = JSON.parse(localStorage.getItem("interbanquetes_mock_users")) || MOCK_INITIAL_USERS;
            
            if (activeUid && mockUsers[activeUid]) {
                const user = mockUsers[activeUid];
                let ownerName = "Miembro Gremial";
                if (user.role === "admin") {
                    ownerName = "Super Administrador";
                } else if (user.role === "seller") {
                    ownerName = user.name || "Vendedor Gremial";
                } else {
                    const localSalons = JSON.parse(localStorage.getItem("interbanquetes_salons")) || MOCK_INITIAL_SALONS;
                    const salon = localSalons.find(s => s.id === user.salonId);
                    if (salon) ownerName = salon.owner;
                }

                currentUser = {
                    uid: user.email,
                    email: user.email,
                    salonId: user.salonId,
                    role: user.role,
                    name: ownerName,
                    authorized: user.authorized
                };
                
                if (!currentUser.authorized && currentUser.role !== "admin") {
                    const localSalons = JSON.parse(localStorage.getItem("interbanquetes_salons")) || MOCK_INITIAL_SALONS;
                    const salon = localSalons.find(s => s.id === user.salonId);
                    callback(null, { status: "pending", salon: salon });
                } else {
                    callback(currentUser);
                }
            } else {
                currentUser = null;
                callback(null);
            }
        }
    },

    login: async (email, password) => {
        if (useRealFirebase) {
            try {
                const credential = await authInstance.signInWithEmailAndPassword(email, password);
                return { success: true, user: credential.user };
            } catch (err) {
                console.error("Error al iniciar sesión:", err);
                let msg = "Contraseña incorrecta o usuario inexistente.";
                if (err.code === "auth/invalid-email") msg = "Formato de correo inválido.";
                if (err.code === "auth/user-disabled") msg = "Este usuario ha sido deshabilitado.";
                return { success: false, error: msg };
            }
        } else {
            // Simulation
            const mockUsers = JSON.parse(localStorage.getItem("interbanquetes_mock_users")) || MOCK_INITIAL_USERS;
            const user = mockUsers[email.toLowerCase().trim()];
            
            if (user && user.password === password) {
                localStorage.setItem("interbanquetes_active_uid", user.email);
                triggerSessionChange();
                return { success: true };
            } else {
                return { success: false, error: "Contraseña incorrecta o usuario no registrado." };
            }
        }
    },

    register: async (email, password, salonData) => {
        if (useRealFirebase) {
            try {
                const credential = await authInstance.createUserWithEmailAndPassword(email, password);
                const uid = credential.user.uid;
                
                const newSalon = {
                    id: uid,
                    name: salonData.name,
                    owner: salonData.owner,
                    phone: salonData.phone || "",
                    username: email.toLowerCase(),
                    capacity: Number(salonData.capacity),
                    address: salonData.address,
                    prices: {
                        friday: Number(salonData.priceFriday),
                        saturday: Number(salonData.priceSaturday),
                        sunday: Number(salonData.priceSunday),
                        weekday: Number(salonData.priceWeekday)
                    },
                    inclusions: [],
                    products: [],
                    bookings: [],
                    authorized: false,
                    role: salonData.role || "owner"
                };
                
                await firestoreDb.collection("salons").doc(uid).set(newSalon);
                await authInstance.signOut();
                return { success: true, salon: newSalon };
            } catch (err) {
                console.error("Error en registro:", err);
                let msg = "Error al intentar crear el registro.";
                if (err.code === "auth/email-already-in-use") msg = "Este correo electrónico ya está en uso.";
                if (err.code === "auth/weak-password") msg = "La contraseña debe tener al menos 6 caracteres.";
                return { success: false, error: msg };
            }
        } else {
            // Simulation
            const mockUsers = JSON.parse(localStorage.getItem("interbanquetes_mock_users")) || {...MOCK_INITIAL_USERS};
            const emailKey = email.toLowerCase().trim();
            
            if (mockUsers[emailKey]) {
                return { success: false, error: "El correo electrónico ya está en uso por otro salón." };
            }
            
            const salonId = "salon_" + Date.now();
            
            mockUsers[emailKey] = {
                email: emailKey,
                password: password,
                salonId: salonId,
                role: salonData.role || "owner",
                name: salonData.owner,
                authorized: false
            };
            localStorage.setItem("interbanquetes_mock_users", JSON.stringify(mockUsers));
            
            const localSalons = JSON.parse(localStorage.getItem("interbanquetes_salons")) || [...MOCK_INITIAL_SALONS];
            const newSalon = {
                id: salonId,
                name: salonData.name,
                owner: salonData.owner,
                phone: salonData.phone || "",
                username: emailKey,
                capacity: Number(salonData.capacity),
                address: salonData.address,
                prices: {
                    friday: Number(salonData.priceFriday),
                    saturday: Number(salonData.priceSaturday),
                    sunday: Number(salonData.priceSunday),
                    weekday: Number(salonData.priceWeekday)
                },
                inclusions: [],
                products: [],
                bookings: [],
                authorized: false,
                role: salonData.role || "owner"
            };
            
            localSalons.push(newSalon);
            localStorage.setItem("interbanquetes_salons", JSON.stringify(localSalons));
            
            localStorage.setItem("interbanquetes_active_uid", emailKey);
            triggerSessionChange();
            return { success: true, salon: newSalon };
        }
    },

    logout: async () => {
        if (useRealFirebase) {
            await authInstance.signOut();
        } else {
            localStorage.removeItem("interbanquetes_active_uid");
            triggerSessionChange();
        }
    },

    sendPasswordReset: async (email) => {
        if (useRealFirebase) {
            try {
                await authInstance.sendPasswordResetEmail(email);
                return { success: true };
            } catch (err) {
                console.error("Error al enviar recuperación:", err);
                let msg = "No pudimos enviar el enlace. Revisa el formato de correo.";
                if (err.code === "auth/user-not-found") msg = "No hay ningún usuario registrado con este correo.";
                return { success: false, error: msg };
            }
        } else {
            const mockUsers = JSON.parse(localStorage.getItem("interbanquetes_mock_users")) || MOCK_INITIAL_USERS;
            if (mockUsers[email.toLowerCase().trim()]) {
                console.log(`[SIMULACIÓN] Enlace de recuperación enviado a: ${email}`);
                return { success: true };
            } else {
                return { success: false, error: "No hay ningún salón registrado con este correo." };
            }
        }
    }
};

// ==========================================
// 5. DATABASE SERVICE WRAPPER (Firestore Compat)
// ==========================================
const appDb = {
    syncSalons: (callback) => {
        if (useRealFirebase) {
            unsubscribeSalons = firestoreDb.collection("salons").onSnapshot((snapshot) => {
                const salonsList = [];
                snapshot.forEach(docSnap => {
                    salonsList.push({ id: docSnap.id, ...docSnap.data() });
                });
                callback(salonsList);
            }, (error) => {
                console.error("Error en base de datos Firestore:", error);
            });
        } else {
            const loadLocal = () => {
                let localSalons = localStorage.getItem("interbanquetes_salons");
                if (!localSalons) {
                    localStorage.setItem("interbanquetes_salons", JSON.stringify(MOCK_INITIAL_SALONS));
                    localSalons = JSON.stringify(MOCK_INITIAL_SALONS);
                }
                callback(JSON.parse(localSalons));
            };
            
            loadLocal();
            
            window.addEventListener("storage", (e) => {
                if (e.key === "interbanquetes_salons") loadLocal();
            });
            window.addEventListener("interbanquetes_db_change", loadLocal);
            
            unsubscribeSalons = () => {
                window.removeEventListener("storage", loadLocal);
                window.removeEventListener("interbanquetes_db_change", loadLocal);
            };
        }
    },

    updateSalon: async (salonId, data) => {
        if (useRealFirebase) {
            const docRef = firestoreDb.collection("salons").doc(salonId);
            await docRef.update({
                name: data.name,
                capacity: Number(data.capacity),
                address: data.address,
                prices: data.prices,
                inclusions: data.inclusions
            });
        } else {
            const localSalons = JSON.parse(localStorage.getItem("interbanquetes_salons"));
            const idx = localSalons.findIndex(s => s.id === salonId);
            if (idx !== -1) {
                localSalons[idx].name = data.name;
                localSalons[idx].capacity = Number(data.capacity);
                localSalons[idx].address = data.address;
                localSalons[idx].prices = data.prices;
                localSalons[idx].inclusions = data.inclusions;
                localStorage.setItem("interbanquetes_salons", JSON.stringify(localSalons));
                window.dispatchEvent(new Event("interbanquetes_db_change"));
            }
        }
    },

    saveBooking: async (salonId, dateStr, bookingDetails) => {
        if (useRealFirebase) {
            const docRef = firestoreDb.collection("salons").doc(salonId);
            const snap = await docRef.get();
            if (snap.exists) {
                let bookings = snap.data().bookings || [];
                bookings = bookings.filter(b => b.date !== dateStr);
                bookings.push({ date: dateStr, ...bookingDetails });
                await docRef.update({ bookings });
            }
        } else {
            const localSalons = JSON.parse(localStorage.getItem("interbanquetes_salons"));
            const salon = localSalons.find(s => s.id === salonId);
            if (salon) {
                if (!salon.bookings) salon.bookings = [];
                salon.bookings = salon.bookings.filter(b => b.date !== dateStr);
                salon.bookings.push({ date: dateStr, ...bookingDetails });
                localStorage.setItem("interbanquetes_salons", JSON.stringify(localSalons));
                window.dispatchEvent(new Event("interbanquetes_db_change"));
            }
        }
    },

    deleteBooking: async (salonId, dateStr) => {
        if (useRealFirebase) {
            const docRef = firestoreDb.collection("salons").doc(salonId);
            const snap = await docRef.get();
            if (snap.exists) {
                let bookings = snap.data().bookings || [];
                bookings = bookings.filter(b => b.date !== dateStr);
                await docRef.update({ bookings });
            }
        } else {
            const localSalons = JSON.parse(localStorage.getItem("interbanquetes_salons"));
            const salon = localSalons.find(s => s.id === salonId);
            if (salon) {
                salon.bookings = (salon.bookings || []).filter(b => b.date !== dateStr);
                localStorage.setItem("interbanquetes_salons", JSON.stringify(localSalons));
                window.dispatchEvent(new Event("interbanquetes_db_change"));
            }
        }
    },

    addProduct: async (salonId, name, price) => {
        const newProd = {
            id: "prod_" + Date.now(),
            name: name,
            price: Number(price)
        };

        if (useRealFirebase) {
            const docRef = firestoreDb.collection("salons").doc(salonId);
            const snap = await docRef.get();
            if (snap.exists) {
                const products = snap.data().products || [];
                products.push(newProd);
                await docRef.update({ products });
            }
        } else {
            const localSalons = JSON.parse(localStorage.getItem("interbanquetes_salons"));
            const salon = localSalons.find(s => s.id === salonId);
            if (salon) {
                if (!salon.products) salon.products = [];
                salon.products.push(newProd);
                localStorage.setItem("interbanquetes_salons", JSON.stringify(localSalons));
                window.dispatchEvent(new Event("interbanquetes_db_change"));
            }
        }
    },

    deleteProduct: async (salonId, productId) => {
        if (useRealFirebase) {
            const docRef = firestoreDb.collection("salons").doc(salonId);
            const snap = await docRef.get();
            if (snap.exists) {
                let products = snap.data().products || [];
                products = products.filter(p => p.id !== productId);
                await docRef.update({ products });
            }
        } else {
            const localSalons = JSON.parse(localStorage.getItem("interbanquetes_salons"));
            const salon = localSalons.find(s => s.id === salonId);
            if (salon) {
                salon.products = (salon.products || []).filter(p => p.id !== productId);
                localStorage.setItem("interbanquetes_salons", JSON.stringify(localSalons));
                window.dispatchEvent(new Event("interbanquetes_db_change"));
            }
        }
    },

    authorizeSalon: async (salonId, email) => {
        if (useRealFirebase) {
            const docRef = firestoreDb.collection("salons").doc(salonId);
            await docRef.update({ authorized: true });
        } else {
            const localSalons = JSON.parse(localStorage.getItem("interbanquetes_salons"));
            const salon = localSalons.find(s => s.id === salonId);
            if (salon) {
                salon.authorized = true;
                localStorage.setItem("interbanquetes_salons", JSON.stringify(localSalons));
            }
            
            const mockUsers = JSON.parse(localStorage.getItem("interbanquetes_mock_users"));
            if (mockUsers[email]) {
                mockUsers[email].authorized = true;
                localStorage.setItem("interbanquetes_mock_users", JSON.stringify(mockUsers));
            }
            window.dispatchEvent(new Event("interbanquetes_db_change"));
        }
    },

    deleteSalon: async (salonId, email) => {
        if (useRealFirebase) {
            await firestoreDb.collection("salons").doc(salonId).delete();
        } else {
            let localSalons = JSON.parse(localStorage.getItem("interbanquetes_salons"));
            localSalons = localSalons.filter(s => s.id !== salonId);
            localStorage.setItem("interbanquetes_salons", JSON.stringify(localSalons));

            const mockUsers = JSON.parse(localStorage.getItem("interbanquetes_mock_users"));
            if (mockUsers[email]) {
                delete mockUsers[email];
                localStorage.setItem("interbanquetes_mock_users", JSON.stringify(mockUsers));
            }
            window.dispatchEvent(new Event("interbanquetes_db_change"));
        }
    },

    seedDemoSalons: async () => {
        const demoSalons = [
            {
                id: "yo_demo",
                name: "Salón El Prado",
                owner: "Yo (Demo)",
                username: "yo@demo.com",
                phone: "300 987 6543",
                capacity: 200,
                address: "Calle de las Rosas #14-25, Sector Norte",
                prices: { friday: 1200000, saturday: 1500000, sunday: 950000, weekday: 700000 },
                inclusions: ["8 horas de alquiler", "Planta eléctrica", "Sonido básico"],
                products: [{ id: "prod_demo1", name: "Servicio de Vigilancia", price: 150000 }],
                bookings: [
                    { date: "2026-11-07", eventName: "Boda de Sofía", guests: 120, clientName: "Sofía Martínez", clientPhone: "300 987 6543" }
                ],
                authorized: true,
                role: "owner"
            },
            {
                id: "toni_demo",
                name: "Toni's Events & Garden",
                owner: "Toni (Demo)",
                username: "toni@demo.com",
                phone: "305 222 3333",
                capacity: 350,
                address: "Av. General Belgrano #88, Zona Campestre",
                prices: { friday: 1800000, saturday: 2200000, sunday: 1400000, weekday: 1000000 },
                inclusions: ["Jardín campestre", "Carpa"],
                products: [],
                bookings: [
                    { date: "2026-11-14", eventName: "Cumpleaños", guests: 80, clientName: "Patricia Rojas", clientPhone: "305 222 3333" }
                ],
                authorized: true,
                role: "owner"
            },
            {
                id: "lina_demo",
                name: "Lina's Palace",
                owner: "Lina (Demo)",
                username: "lina@demo.com",
                phone: "312 999 8888",
                capacity: 150,
                address: "Carrera 45 #10-80, El Poblado",
                prices: { friday: 1100000, saturday: 1300000, sunday: 900000, weekday: 650000 },
                inclusions: ["Aire acondicionado", "Sillas Tiffany"],
                products: [],
                bookings: [
                    { date: "2026-11-21", eventName: "Graduación", guests: 100, clientName: "Rectoría San José", clientPhone: "312 999 8888" }
                ],
                authorized: true,
                role: "owner"
            }
        ];
        
        const isReal = (typeof firebase !== 'undefined' && firebaseConfig.apiKey && firebaseConfig.apiKey !== "REPLACE_WITH_YOUR_API_KEY");
        if (isReal) {
            for (const salon of demoSalons) {
                await firestoreDb.collection("salons").doc(salon.id).set(salon);
            }
        } else {
            localStorage.setItem("interbanquetes_salons", JSON.stringify(demoSalons));
            window.dispatchEvent(new Event("interbanquetes_db_change"));
        }
    }
};

function triggerSessionChange() {
    window.dispatchEvent(new Event("interbanquetes_session_change"));
}

// ==========================================
// 6. DATE HELPER FUNCTIONS
// ==========================================

function parseLocalDate(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
}

function formatLocalDate(dateObj) {
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function getDayInfo(dateStr) {
    const date = parseLocalDate(dateStr);
    const dayIndex = date.getDay();
    let type = "weekday";
    let name = "Día de Semana";
    
    if (dayIndex === 0) {
        type = "sunday";
        name = "Domingo";
    } else if (dayIndex === 5) {
        type = "friday";
        name = "Viernes";
    } else if (dayIndex === 6) {
        type = "saturday";
        name = "Sábado";
    } else {
        const names = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
        name = names[dayIndex];
    }
    
    return { type, name };
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

function formatLongDate(dateStr) {
    const date = parseLocalDate(dateStr);
    const months = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];
    const info = getDayInfo(dateStr);
    return `${info.name}, ${date.getDate()} de ${months[date.getMonth()]} de ${date.getFullYear()}`;
}

// ==========================================
// 7. RENDER ENGINE & VIEWS
// ==========================================

function renderAllViews() {
    renderUserBadge();
    renderCalendar();
    renderSelectedDateDetails();
    renderDirectory();
    renderProfileEditor();
    renderAdminPanel();
    updateSessionSwitcherActiveState();
}

function renderUserBadge() {
    const avatarEl = document.getElementById("user-avatar");
    const nameEl = document.getElementById("user-name-display");
    const roleEl = document.getElementById("user-role-display");
    
    if (!currentUser) return;

    if (currentUser.role === "admin") {
        avatarEl.textContent = "Ad";
        avatarEl.className = "avatar user-bg-admin";
        nameEl.textContent = currentUser.name;
        roleEl.textContent = "Super Administrador";
        
        document.getElementById("nav-admin").classList.remove("hidden");
        document.getElementById("nav-my-salon").classList.add("hidden");
    } else if (currentUser.role === "seller") {
        avatarEl.textContent = currentUser.name.charAt(0).toUpperCase();
        avatarEl.className = "avatar user-bg-yo";
        nameEl.textContent = currentUser.name;
        roleEl.textContent = "Vendedor Gremial";
        
        document.getElementById("nav-admin").classList.add("hidden");
        document.getElementById("nav-my-salon").classList.add("hidden");
    } else {
        const salon = salons.find(s => s.id === currentUser.salonId);
        const initial = currentUser.name.charAt(0);
        avatarEl.textContent = initial;
        
        let colorClass = "yo";
        if (currentUser.email.includes("toni")) colorClass = "toni";
        else if (currentUser.email.includes("lina")) colorClass = "lina";
        
        avatarEl.className = `avatar user-bg-${colorClass}`;
        nameEl.textContent = currentUser.name;
        roleEl.textContent = salon ? salon.name : "Propietario";
        
        document.getElementById("nav-admin").classList.add("hidden");
        document.getElementById("nav-my-salon").classList.remove("hidden");
    }
}

function renderCalendar() {
    const container = document.getElementById("calendar-days-container");
    const monthYearTitle = document.getElementById("month-year-title");
    
    if (!container) return;
    container.innerHTML = "";
    
    const year = currentMonthDate.getFullYear();
    const month = currentMonthDate.getMonth();
    
    const monthsSpanish = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];
    monthYearTitle.textContent = `${monthsSpanish[month]} ${year}`;
    
    const firstDay = new Date(year, month, 1);
    let startDayOfWeek = firstDay.getDay(); 
    if (startDayOfWeek === 0) startDayOfWeek = 7; 
    
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    for (let i = 1; i < startDayOfWeek; i++) {
        const emptyCell = document.createElement("div");
        emptyCell.className = "cal-day-cell empty";
        container.appendChild(emptyCell);
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayCell = document.createElement("div");
        dayCell.className = "cal-day-cell";
        
        if (dateStr === selectedDateStr) {
            dayCell.classList.add("selected");
        }
        
        if (currentUser && currentUser.role === "owner" && currentUser.salonId) {
            const mySalon = salons.find(s => s.id === currentUser.salonId);
            if (mySalon && mySalon.bookings && mySalon.bookings.some(b => b.date === dateStr)) {
                dayCell.classList.add("my-own-booking");
            }
        }
        
        const today = new Date();
        if (dateStr === formatLocalDate(today)) {
            dayCell.classList.add("today");
        }
        
        dayCell.innerHTML = `<span class="cal-day-number">${day}</span>`;
        
        const totalSalons = salons.filter(s => s.authorized === true && s.role === "owner").length;
        let bookedCount = 0;
        
        salons.filter(s => s.authorized === true && s.role === "owner").forEach(salon => {
            if (salon.bookings && salon.bookings.some(b => b.date === dateStr)) {
                bookedCount++;
            }
        });
        
        if (totalSalons > 0) {
            if (bookedCount === 0) {
                dayCell.classList.add("status-all-available");
            } else if (bookedCount === totalSalons) {
                dayCell.classList.add("status-all-busy");
            } else {
                dayCell.classList.add("status-mixed-available");
            }
        }
        
        const indicatorsWrapper = document.createElement("div");
        indicatorsWrapper.className = "cal-status-indicators";
        
        salons.filter(s => s.authorized === true && s.role === "owner").forEach(salon => {
            const dot = document.createElement("span");
            dot.className = "indicator-dot";
            const isBooked = salon.bookings && salon.bookings.some(b => b.date === dateStr);
            dot.style.backgroundColor = isBooked ? "var(--color-danger)" : "var(--color-success)";
            dot.title = `${salon.name}: ${isBooked ? 'Ocupado' : 'Disponible'}`;
            indicatorsWrapper.appendChild(dot);
        });
        dayCell.appendChild(indicatorsWrapper);
        
        dayCell.addEventListener("click", () => {
            selectedDateStr = dateStr;
            const allCells = container.querySelectorAll(".cal-day-cell");
            allCells.forEach(cell => cell.classList.remove("selected"));
            dayCell.classList.add("selected");
            renderSelectedDateDetails();
        });
        
        container.appendChild(dayCell);
    }
}

function renderSelectedDateDetails() {
    const titleEl = document.getElementById("selected-date-title");
    const badgeEl = document.getElementById("date-day-type-badge");
    const listEl = document.getElementById("date-salon-status-list");
    
    if (!titleEl) return;

    const dayInfo = getDayInfo(selectedDateStr);
    titleEl.textContent = formatLongDate(selectedDateStr);
    badgeEl.textContent = dayInfo.name;
    
    if (dayInfo.type === "saturday") {
        badgeEl.style.borderColor = "rgba(212, 175, 55, 0.4)";
        badgeEl.style.color = "var(--color-primary)";
        badgeEl.style.background = "rgba(212, 175, 55, 0.1)";
    } else if (dayInfo.type === "friday") {
        badgeEl.style.borderColor = "rgba(245, 158, 11, 0.4)";
        badgeEl.style.color = "var(--color-warning)";
        badgeEl.style.background = "rgba(245, 158, 11, 0.1)";
    } else if (dayInfo.type === "sunday") {
        badgeEl.style.borderColor = "rgba(59, 130, 246, 0.4)";
        badgeEl.style.color = "#60a5fa";
        badgeEl.style.background = "rgba(59, 130, 246, 0.1)";
    } else {
        badgeEl.style.borderColor = "rgba(148, 163, 184, 0.4)";
        badgeEl.style.color = "var(--text-muted)";
        badgeEl.style.background = "rgba(148, 163, 184, 0.1)";
    }
    
    listEl.innerHTML = "";
    
    const activeSalons = salons.filter(s => s.authorized === true && s.role === "owner");
    
    activeSalons.forEach(salon => {
        const booking = salon.bookings ? salon.bookings.find(b => b.date === selectedDateStr) : null;
        const isBooked = !!booking;
        const dayPrice = salon.prices[dayInfo.type];
        
        const item = document.createElement("div");
        item.className = "salon-status-item";
        
        let internalInfoHTML = "";
        if (isBooked && currentUser && (currentUser.salonId === salon.id || currentUser.role === 'admin')) {
            internalInfoHTML = `
                <div class="booking-internal-info" style="font-size: 0.75rem; color: var(--color-danger); margin-top: 3px; font-weight: 500;">
                    🔒 Interno: <strong>${booking.eventName || 'Evento'}</strong> (${booking.guests || '?'} pax) | <strong>${booking.clientName || 'N/A'}</strong> (${booking.clientPhone || 'N/A'})
                </div>
            `;
        }
        
        let contactHTML = "";
        if (currentUser && (currentUser.role === 'owner' || currentUser.role === 'admin')) {
            contactHTML = `
                <div class="salon-contact-links" style="font-size: 0.72rem; margin-top: 2px;">
                    <a href="tel:${salon.phone}" style="color: var(--color-primary); text-decoration: none; margin-right: 8px;">📞 ${salon.phone || 'N/A'}</a>
                    <a href="mailto:${salon.username}" style="color: var(--text-muted); text-decoration: none;">✉️ ${salon.username}</a>
                </div>
            `;
        }
        
        item.innerHTML = `
            <div class="salon-status-left" style="flex-grow: 1;">
                <span class="status-indicator-icon ${isBooked ? 'busy' : 'available'}" style="flex-shrink: 0;">
                    ${isBooked ? 
                        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>` : 
                        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`
                    }
                </span>
                <div class="salon-meta" style="flex-grow: 1;">
                    <div>
                        <span class="salon-name" style="font-weight: 600;">${salon.name}</span>
                        <span class="salon-owner" style="font-size: 0.75rem; color: var(--text-muted);"> - Propietario: ${salon.owner}</span>
                        ${contactHTML}
                    </div>
                    ${internalInfoHTML}
                </div>
            </div>
            <div class="salon-status-right" style="flex-shrink: 0; margin-left: 10px;">
                <div class="price-display-guild">${formatCurrency(dayPrice)}</div>
                <div class="price-label-guild">Alquiler ${dayInfo.name}</div>
            </div>
        `;
        listEl.appendChild(item);
    });
    
    const actionBox = document.getElementById("my-salon-action-box");
    const mySalonNameLabel = document.getElementById("my-salon-name-label");
    
    if (currentUser && currentUser.role === "owner" && currentUser.salonId) {
        actionBox.classList.remove("hidden");
        const mySalon = salons.find(s => s.id === currentUser.salonId);
        
        if (mySalon) {
            mySalonNameLabel.textContent = mySalon.name;
            const booking = mySalon.bookings ? mySalon.bookings.find(b => b.date === selectedDateStr) : null;
            const isBooked = !!booking;
            
            const eventInput = document.getElementById("my-booking-event");
            const guestsInput = document.getElementById("my-booking-guests");
            const clientInput = document.getElementById("my-booking-client");
            const phoneInput = document.getElementById("my-booking-phone");
            
            const btnSave = document.getElementById("btn-save-booking");
            const btnDelete = document.getElementById("btn-delete-booking");
            
            if (isBooked) {
                eventInput.value = booking.eventName || "";
                guestsInput.value = booking.guests || "";
                clientInput.value = booking.clientName || "";
                phoneInput.value = booking.clientPhone || "";
                
                btnDelete.classList.remove("hidden");
                btnSave.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                    Actualizar Reserva
                `;
            } else {
                eventInput.value = "";
                guestsInput.value = "";
                clientInput.value = "";
                phoneInput.value = "";
                
                btnDelete.classList.add("hidden");
                btnSave.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="12 5 12 19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Reservar / Bloquear
                `;
            }
        }
    } else {
        actionBox.classList.add("hidden");
    }
}

function renderDirectory() {
    const container = document.getElementById("salons-directory-container");
    if (!container) return;
    container.innerHTML = "";
    
    const activeSalons = salons.filter(s => s.authorized === true && s.role === "owner");
    
    if (activeSalons.length === 0) {
        container.innerHTML = `<div class="card" style="grid-column: 1/-1; text-align: center;"><p>No hay salones habilitados en el gremio todavía.</p></div>`;
        return;
    }
    
    activeSalons.forEach(salon => {
        const card = document.createElement("div");
        card.className = "card salon-card";
        
        const isMine = (currentUser && currentUser.role === "owner" && currentUser.salonId === salon.id);
        if (isMine) {
            card.style.border = "1.5px solid var(--color-primary)";
        }
        
        let inclusionsHTML = "";
        if (salon.inclusions && salon.inclusions.length > 0) {
            inclusionsHTML = `
                <div class="inclusions-wrapper">
                    <h5 class="inclusions-title">Alquiler Base Incluye:</h5>
                    <div class="inclusions-tags">
                        ${salon.inclusions.map(inc => `<span class="inclusion-tag">${inc}</span>`).join('')}
                    </div>
                </div>
            `;
        }
        
        let productsHTML = "";
        if (salon.products && salon.products.length > 0) {
            productsHTML = `
                <div class="products-wrapper">
                    <h5 class="products-title">Otros Productos Gremiales:</h5>
                    <ul class="products-mini-list">
                        ${salon.products.map(prod => `
                            <li>
                                <span class="prod-mini-name">${prod.name}</span>
                                <span class="prod-mini-price">${formatCurrency(prod.price)}</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            `;
        }
        
        let contactHTML = "";
        if (currentUser && (currentUser.role === 'owner' || currentUser.role === 'admin')) {
            contactHTML = `
                <div class="salon-card-contact-info" style="margin-top: 0.5rem; font-size: 0.85rem; color: var(--text-muted); display: flex; flex-direction: column; gap: 0.25rem;">
                    <span>📞 <a href="tel:${salon.phone}" style="color: var(--color-primary); text-decoration: none; font-weight: 500;">${salon.phone || 'Sin teléfono'}</a></span>
                    <span>✉️ <a href="mailto:${salon.username}" style="color: var(--text-muted); text-decoration: none;">${salon.username}</a></span>
                </div>
            `;
        }
        
        card.innerHTML = `
            <div>
                <div class="salon-card-header flex-between">
                    <div>
                        <h3>${salon.name}</h3>
                        <span class="owner-label">Contacto: ${salon.owner} ${isMine ? '(Tú)' : ''}</span>
                        ${contactHTML}
                    </div>
                </div>
                
                <ul class="salon-details-list">
                    <li>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                        Capacidad: ${salon.capacity} personas
                    </li>
                    <li>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        Ubicación: ${salon.address}
                    </li>
                </ul>

                <h5 class="inclusions-title">Tarifas del Gremio por Día:</h5>
                <div class="prices-badge-grid">
                    <div class="price-badge">
                        <span class="price-badge-lbl">Sábados</span>
                        <span class="price-badge-val">${formatCurrency(salon.prices.saturday)}</span>
                    </div>
                    <div class="price-badge">
                        <span class="price-badge-lbl">Viernes</span>
                        <span class="price-badge-val">${formatCurrency(salon.prices.friday)}</span>
                    </div>
                    <div class="price-badge">
                        <span class="price-badge-lbl">Domingos</span>
                        <span class="price-badge-val">${formatCurrency(salon.prices.sunday)}</span>
                    </div>
                    <div class="price-badge">
                        <span class="price-badge-lbl">Resto Semana</span>
                        <span class="price-badge-val">${formatCurrency(salon.prices.weekday)}</span>
                    </div>
                </div>

                ${inclusionsHTML}
            </div>
            ${productsHTML}
        `;
        container.appendChild(card);
    });
}

function renderProfileEditor() {
    const layoutEl = document.getElementById("profile-edit-layout");
    const adminMsgEl = document.getElementById("admin-profile-msg");
    
    if (!layoutEl) return;

    if (!currentUser || currentUser.role === "admin") {
        layoutEl.classList.add("hidden");
        adminMsgEl.classList.remove("hidden");
        return;
    }
    
    layoutEl.classList.remove("hidden");
    adminMsgEl.classList.add("hidden");
    
    const salon = salons.find(s => s.id === currentUser.salonId);
    if (!salon) return;
    
    document.getElementById("profile-salon-id").value = salon.id;
    document.getElementById("profile-name").value = salon.name;
    document.getElementById("profile-capacity").value = salon.capacity;
    document.getElementById("profile-address").value = salon.address;
    
    document.getElementById("price-friday").value = salon.prices.friday;
    document.getElementById("price-saturday").value = salon.prices.saturday;
    document.getElementById("price-sunday").value = salon.prices.sunday;
    document.getElementById("price-weekday").value = salon.prices.weekday;
    
    document.getElementById("profile-inclusions").value = salon.inclusions ? salon.inclusions.join(', ') : "";
    
    const prodListEl = document.getElementById("my-products-list");
    prodListEl.innerHTML = "";
    
    if (!salon.products || salon.products.length === 0) {
        prodListEl.innerHTML = `<li style="font-size: 0.8rem; color: var(--text-muted); justify-content: center;">No tienes productos adicionales listados.</li>`;
    } else {
        salon.products.forEach(prod => {
            const li = document.createElement("li");
            li.innerHTML = `
                <div class="editable-prod-info">
                    <span class="editable-prod-name">${prod.name}</span>
                    <span class="editable-prod-price">${formatCurrency(prod.price)}</span>
                </div>
                <button type="button" class="btn-delete-prod" data-prod-id="${prod.id}" title="Eliminar Producto">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                </button>
            `;
            
            li.querySelector(".btn-delete-prod").addEventListener("click", () => {
                appDb.deleteProduct(salon.id, prod.id);
            });
            prodListEl.appendChild(li);
        });
    }
}

function renderAdminPanel() {
    const listContainer = document.getElementById("admin-salons-list-container");
    if (!listContainer) return;
    listContainer.innerHTML = "";
    
    if (salons.length === 0) {
        listContainer.innerHTML = `
            <div class="no-records-card" style="text-align: center; padding: 3rem; color: var(--text-muted);">
                <span style="font-size: 2.5rem; display: block; margin-bottom: 1rem;">🏢</span>
                No hay salones registrados en la red.
            </div>
        `;
        return;
    }
    
    // Sort salons so unauthorized (pending approval) ones are on top
    const sortedSalons = [...salons].sort((a, b) => {
        if (a.authorized === b.authorized) return 0;
        return a.authorized ? 1 : -1;
    });
    
    sortedSalons.forEach(salon => {
        const item = document.createElement("div");
        item.className = `admin-salon-row-card ${salon.authorized ? 'active' : 'pending'}`;
        
        let statusBadgeHTML = "";
        let actionsHTML = "";
        
        const isSeller = salon.role === "seller";
        const displayName = isSeller ? `👤 ${salon.owner} (Vendedor)` : salon.name;
        const locationHTML = isSeller ? `<span style="font-size: 0.8rem; color: var(--color-primary);">Acceso de Vendedor Gremial</span>` : `📍 ${salon.address}`;
        
        if (!salon.authorized) {
            statusBadgeHTML = `<span class="admin-status-tag pending">Pendiente</span>`;
            actionsHTML = `
                <div class="admin-action-buttons">
                    <button class="btn btn-approve-salon-action" data-salon-id="${salon.id}" data-email="${salon.username}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                        Autorizar
                    </button>
                    <button class="btn btn-reject-salon-action" data-salon-id="${salon.id}" data-email="${salon.username}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        Rechazar
                    </button>
                </div>
            `;
        } else {
            statusBadgeHTML = `<span class="admin-status-tag active">Activo</span>`;
            actionsHTML = `
                <div class="admin-action-buttons">
                    ${isSeller ? '' : `
                    <button class="btn btn-icon-action edit" data-salon-id="${salon.id}" title="Editar Salón">
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                        Editar
                    </button>
                    `}
                    <button class="btn btn-icon-action delete" data-salon-id="${salon.id}" data-email="${salon.username}" title="Eliminar Miembro">
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                        Eliminar
                    </button>
                </div>
            `;
        }
        
        let pricesSectionHTML = "";
        if (isSeller) {
            pricesSectionHTML = `
                <div class="admin-prices-grid" style="display: flex; align-items: center; justify-content: center; height: 100%;">
                    <span class="admin-status-tag" style="background: rgba(212, 175, 55, 0.1); color: var(--color-primary); border: 1px solid rgba(212, 175, 55, 0.2); font-weight: 600; padding: 0.5rem 0.75rem;">SOLO LECTURA DE CALENDARIO</span>
                </div>
            `;
        } else {
            pricesSectionHTML = `
                <div class="admin-prices-grid">
                    <div class="admin-price-badge"><span>Sáb:</span><strong>${formatCurrency(salon.prices.saturday)}</strong></div>
                    <div class="admin-price-badge"><span>Vie:</span><strong>${formatCurrency(salon.prices.friday)}</strong></div>
                    <div class="admin-price-badge"><span>Dom:</span><strong>${formatCurrency(salon.prices.sunday)}</strong></div>
                    <div class="admin-price-badge"><span>Sem:</span><strong>${formatCurrency(salon.prices.weekday)}</strong></div>
                </div>
            `;
        }
        
        const initial = (salon.owner || salon.name || "M").charAt(0).toUpperCase();
        let colorClass = "yo";
        if (salon.username.includes("toni")) colorClass = "toni";
        else if (salon.username.includes("lina")) colorClass = "lina";
        else if (isSeller) colorClass = "yo";
        
        item.innerHTML = `
            <div class="admin-salon-header-section">
                <div class="avatar-admin user-bg-${colorClass}">${initial}</div>
                <div class="admin-salon-title-info">
                    <div class="flex-align-center" style="gap: 0.5rem; flex-wrap: wrap;">
                        <h4>${displayName}</h4>
                        ${statusBadgeHTML}
                    </div>
                    <span class="admin-salon-address-lbl">${locationHTML}</span>
                </div>
            </div>
            
            <div class="admin-salon-contact-section">
                <span class="contact-lbl">${isSeller ? 'Nombre de Vendedor' : 'Propietario / Contacto'}</span>
                <strong>${salon.owner}</strong>
                <a href="mailto:${salon.username}" class="contact-email">${salon.username}</a>
                <a href="tel:${salon.phone}" class="contact-phone">📞 ${salon.phone || 'Sin Teléfono'}</a>
            </div>
            
            <div class="admin-salon-prices-section">
                <span class="pricing-lbl">${isSeller ? 'Permisos del Perfil' : 'Tarifas del Gremio'}</span>
                ${pricesSectionHTML}
            </div>
            
            <div class="admin-salon-actions-section">
                ${actionsHTML}
            </div>
        `;
        
        if (!salon.authorized) {
            item.querySelector(".btn-approve-salon-action").addEventListener("click", async () => {
                const targetName = isSeller ? salon.owner : salon.name;
                if (confirm(`¿Autorizar al usuario "${targetName}" para acceder a la red del gremio?`)) {
                    await appDb.authorizeSalon(salon.id, salon.username);
                }
            });
            item.querySelector(".btn-reject-salon-action").addEventListener("click", async () => {
                const targetName = isSeller ? salon.owner : salon.name;
                const c1 = confirm(`¿Rechazar y eliminar la solicitud de "${targetName}"?`);
                if (c1) {
                    const c2 = confirm(`🚨 ¿Confirmas por segunda vez rechazar y eliminar permanentemente la solicitud de "${targetName}"?`);
                    if (c2) {
                        await appDb.deleteSalon(salon.id, salon.username);
                    }
                }
            });
        } else {
            const editBtn = item.querySelector(".btn-icon-action.edit");
            if (editBtn) {
                editBtn.addEventListener("click", () => {
                    openAdminEditModal(salon.id);
                });
            }
            item.querySelector(".btn-icon-action.delete").addEventListener("click", async () => {
                const targetName = isSeller ? salon.owner : salon.name;
                const c1 = confirm(`¿Estás seguro de que deseas eliminar permanentemente a "${targetName}" del gremio?`);
                if (c1) {
                    const c2 = confirm(`🚨 ¡Acción Irreversible! Confirma por segunda vez la eliminación de "${targetName}". Se borrarán todos sus datos y reservas.`);
                    if (c2) {
                        await appDb.deleteSalon(salon.id, salon.username);
                    }
                }
            });
        }
        
        listContainer.appendChild(item);
    });
}

function switchTab(tabId) {
    activeTab = tabId;
    const panes = document.querySelectorAll(".tab-pane");
    panes.forEach(pane => pane.classList.remove("active"));
    
    const navItems = document.querySelectorAll(".nav-item");
    navItems.forEach(item => item.classList.remove("active"));
    
    const targetPane = document.getElementById(`tab-${tabId}`);
    if (targetPane) targetPane.classList.add("active");
    
    const targetNav = document.querySelector(`.nav-item[data-tab="${tabId}"]`);
    if (targetNav) targetNav.classList.add("active");
    
    const sectionTitle = document.getElementById("section-title");
    if (sectionTitle) {
        switch (tabId) {
            case "calendar": sectionTitle.textContent = "Calendario del Gremio"; break;
            case "directory": sectionTitle.textContent = "Directorio y Precios Gremiales"; break;
            case "profile": sectionTitle.textContent = "Mi Salón y Tarifas"; break;
            case "admin": sectionTitle.textContent = "Panel Super Administrador"; break;
            case "packages": sectionTitle.textContent = "Constructor de Paquetes"; break;
        }
    }
}

// ==========================================
// 8. MODAL CONTROLS
// ==========================================

function openSearchDateModal(dateStr) {
    const modal = document.getElementById("search-modal");
    const dateLabelEl = document.getElementById("search-modal-date");
    const dayTypeLabelEl = document.getElementById("search-modal-day-type");
    const resultsContainer = document.getElementById("search-modal-results");
    
    const dayInfo = getDayInfo(dateStr);
    
    dateLabelEl.textContent = formatLongDate(dateStr);
    dayTypeLabelEl.textContent = dayInfo.name;
    
    resultsContainer.innerHTML = "";
    const activeSalons = salons.filter(s => s.authorized === true && s.role === "owner");
    
    activeSalons.forEach(salon => {
        const booking = salon.bookings ? salon.bookings.find(b => b.date === dateStr) : null;
        const isBooked = !!booking;
        const price = salon.prices[dayInfo.type];
        
        const item = document.createElement("div");
        item.className = `modal-salon-item ${isBooked ? 'busy' : 'available'}`;
        
        let internalInfoHTML = "";
        if (isBooked && currentUser && (currentUser.salonId === salon.id || currentUser.role === 'admin')) {
            internalInfoHTML = `
                <div class="booking-internal-info" style="font-size: 0.75rem; color: var(--color-danger); margin-top: 3px; font-weight: 500;">
                    🔒 Interno: <strong>${booking.eventName || 'Evento'}</strong> (${booking.guests || '?'} pax) | <strong>${booking.clientName || 'N/A'}</strong> (${booking.clientPhone || 'N/A'})
                </div>
            `;
        }
        
        let contactHTML = "";
        if (currentUser && (currentUser.role === 'owner' || currentUser.role === 'admin')) {
            contactHTML = `
                <div class="salon-contact-links" style="font-size: 0.72rem; margin-top: 2px;">
                    <a href="tel:${salon.phone}" style="color: var(--color-primary); text-decoration: none; margin-right: 8px;">📞 ${salon.phone || 'N/A'}</a>
                    <a href="mailto:${salon.username}" style="color: var(--text-muted); text-decoration: none;">✉️ ${salon.username}</a>
                </div>
            `;
        }
        
        item.innerHTML = `
            <div class="modal-salon-details" style="flex-grow: 1;">
                <span class="modal-salon-status-badge ${isBooked ? 'busy' : 'available'}" style="flex-shrink: 0;">
                    ${isBooked ? 'Ocupado' : 'Disponible'}
                </span>
                <div class="modal-salon-meta" style="flex-grow: 1;">
                    <h4>${salon.name}</h4>
                    <p style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 2px;">Contacto: ${salon.owner}</p>
                    ${contactHTML}
                    ${internalInfoHTML}
                </div>
            </div>
            <div class="modal-salon-price-info" style="flex-shrink: 0; margin-left: 10px;">
                <div class="price-val">${formatCurrency(price)}</div>
                <div class="price-lbl">Precio Gremio (${dayInfo.name})</div>
            </div>
        `;
        resultsContainer.appendChild(item);
    });
    
    modal.classList.add("active");
}

function closeSearchDateModal() {
    document.getElementById("search-modal").classList.remove("active");
}

function openAdminEditModal(salonId = null) {
    const modal = document.getElementById("admin-salon-modal");
    const titleEl = document.getElementById("admin-modal-title");
    const form = document.getElementById("admin-salon-form");
    
    form.reset();
    
    if (salonId) {
        titleEl.textContent = "Editar Detalles de Salón";
        const salon = salons.find(s => s.id === salonId);
        if (salon) {
            document.getElementById("admin-salon-id-input").value = salon.id;
            document.getElementById("admin-salon-name").value = salon.name;
            document.getElementById("admin-salon-owner").value = salon.owner;
            document.getElementById("admin-salon-username").value = salon.username;
            document.getElementById("admin-salon-username").disabled = true;
            document.getElementById("admin-salon-capacity").value = salon.capacity;
            document.getElementById("admin-salon-address").value = salon.address;
            
            document.getElementById("admin-price-friday").value = salon.prices.friday;
            document.getElementById("admin-price-saturday").value = salon.prices.saturday;
            document.getElementById("admin-price-sunday").value = salon.prices.sunday;
            document.getElementById("admin-price-weekday").value = salon.prices.weekday;
            
            document.getElementById("admin-salon-inclusions").value = salon.inclusions ? salon.inclusions.join(', ') : "";
        }
    }
    
    modal.classList.add("active");
}

function closeAdminModal() {
    document.getElementById("admin-salon-modal").classList.remove("active");
}

// ==========================================
// 9. EVENT LISTENERS REGISTER
// ==========================================

function registerEventListeners() {
    const navItems = document.querySelectorAll(".nav-item");
    navItems.forEach(item => {
        item.addEventListener("click", () => {
            const tabId = item.getAttribute("data-tab");
            if (tabId) switchTab(tabId);
        });
    });
    
    // Admin buttons listeners
    const btnAddSalon = document.getElementById("btn-show-add-salon");
    if (btnAddSalon) {
        btnAddSalon.addEventListener("click", () => openAdminEditModal());
    }
    
    const btnSeedDemo = document.getElementById("btn-admin-seed-demo");
    if (btnSeedDemo) {
        btnSeedDemo.addEventListener("click", async () => {
            if (confirm("¿Inicializar el sistema con los salones demo en la base de datos (Prado, Toni, Lina)?")) {
                await appDb.seedDemoSalons();
                alert("Salones demo inicializados con éxito.");
            }
        });
    }
    
    document.getElementById("btn-logout").addEventListener("click", async () => {
        if (confirm("¿Cerrar sesión de la red de Interbanquetes?")) {
            await appAuth.logout();
        }
    });

    document.getElementById("prev-month").addEventListener("click", () => {
        currentMonthDate.setMonth(currentMonthDate.getMonth() - 1);
        renderCalendar();
    });
    
    document.getElementById("next-month").addEventListener("click", () => {
        currentMonthDate.setMonth(currentMonthDate.getMonth() + 1);
        renderCalendar();
    });
    
    document.getElementById("btn-quick-check").addEventListener("click", () => {
        const inputVal = document.getElementById("quick-date-input").value;
        if (inputVal) {
            selectedDateStr = inputVal;
            const searchedDate = parseLocalDate(selectedDateStr);
            currentMonthDate = new Date(searchedDate.getFullYear(), searchedDate.getMonth(), 1);
            
            renderCalendar();
            renderSelectedDateDetails();
            openSearchDateModal(selectedDateStr);
        }
    });
    
    document.getElementById("btn-save-booking").addEventListener("click", async () => {
        if (currentUser && currentUser.role === "owner" && currentUser.salonId) {
            const mySalon = salons.find(s => s.id === currentUser.salonId);
            const booking = mySalon && mySalon.bookings ? mySalon.bookings.find(b => b.date === selectedDateStr) : null;
            const isEditing = !!booking;
            
            if (isEditing) {
                const c1 = confirm("⚠️ ¿Confirmas que deseas modificar los datos de esta reserva existente?");
                if (!c1) return;
                const c2 = confirm("🚨 ¿Confirmas por segunda vez aplicar las modificaciones a la reserva?");
                if (!c2) return;
            }
            
            const eventVal = document.getElementById("my-booking-event").value.trim();
            const guestsVal = document.getElementById("my-booking-guests").value;
            const clientVal = document.getElementById("my-booking-client").value.trim();
            const phoneVal = document.getElementById("my-booking-phone").value.trim();
            
            await appDb.saveBooking(currentUser.salonId, selectedDateStr, {
                eventName: eventVal || "Reservado",
                guests: guestsVal ? Number(guestsVal) : "",
                clientName: clientVal,
                clientPhone: phoneVal
            });
        }
    });
    
    document.getElementById("btn-delete-booking").addEventListener("click", async () => {
        if (currentUser && currentUser.role === "owner" && currentUser.salonId) {
            const c1 = confirm("⚠️ ¿Estás seguro de que deseas liberar esta fecha y borrar la reserva?");
            if (c1) {
                const c2 = confirm("🚨 ¡Acción Irreversible! Confirma por segunda vez liberar la fecha y borrar permanentemente los datos del cliente.");
                if (c2) {
                    await appDb.deleteBooking(currentUser.salonId, selectedDateStr);
                }
            }
        }
    });
    
    document.getElementById("salon-profile-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const salonId = document.getElementById("profile-salon-id").value;
        
        const data = {
            name: document.getElementById("profile-name").value,
            capacity: document.getElementById("profile-capacity").value,
            address: document.getElementById("profile-address").value,
            prices: {
                friday: Number(document.getElementById("price-friday").value),
                saturday: Number(document.getElementById("price-saturday").value),
                sunday: Number(document.getElementById("price-sunday").value),
                weekday: Number(document.getElementById("price-weekday").value)
            },
            inclusions: document.getElementById("profile-inclusions").value.split(',').map(s => s.trim()).filter(s => s.length > 0)
        };
        
        try {
            await appDb.updateSalon(salonId, data);
            const statusMsg = document.getElementById("save-status-msg");
            statusMsg.textContent = "✓ Cambios Guardados";
            statusMsg.className = "save-status-msg success";
            setTimeout(() => { statusMsg.textContent = ""; }, 3000);
        } catch (err) {
            alert("Error al actualizar perfil.");
        }
    });
    
    document.getElementById("btn-add-product").addEventListener("click", async () => {
        if (currentUser && currentUser.role === "owner" && currentUser.salonId) {
            const nameInput = document.getElementById("new-prod-name");
            const priceInput = document.getElementById("new-prod-price");
            const name = nameInput.value.trim();
            const price = Number(priceInput.value);
            
            if (name && !isNaN(price) && price > 0) {
                await appDb.addProduct(currentUser.salonId, name, price);
                nameInput.value = "";
                priceInput.value = "";
            } else {
                alert("Ingresa un producto y precio válidos.");
            }
        }
    });
    
    document.getElementById("btn-close-search-modal").addEventListener("click", closeSearchDateModal);
    document.getElementById("btn-close-admin-modal").addEventListener("click", closeAdminModal);
    document.getElementById("btn-admin-cancel").addEventListener("click", closeAdminModal);
    
    document.getElementById("admin-salon-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const salonId = document.getElementById("admin-salon-id-input").value;
        const data = {
            name: document.getElementById("admin-salon-name").value,
            capacity: document.getElementById("admin-salon-capacity").value,
            address: document.getElementById("admin-salon-address").value,
            prices: {
                friday: Number(document.getElementById("admin-price-friday").value),
                saturday: Number(document.getElementById("admin-price-saturday").value),
                sunday: Number(document.getElementById("admin-price-sunday").value),
                weekday: Number(document.getElementById("admin-price-weekday").value)
            },
            inclusions: document.getElementById("admin-salon-inclusions").value.split(',').map(s => s.trim()).filter(s => s.length > 0)
        };
        
        try {
            await appDb.updateSalon(salonId, data);
            closeAdminModal();
        } catch (err) {
            alert("Error al actualizar salón.");
        }
    });
    
    window.addEventListener("click", (e) => {
        if (e.target === document.getElementById("search-modal")) closeSearchDateModal();
        if (e.target === document.getElementById("admin-salon-modal")) closeAdminModal();
    });

    setupAuthListeners();
    initSessionSwitcher(); // Fix: Hook session switcher buttons
}

function setupAuthListeners() {
    const authWrapper = document.getElementById("auth-screen");
    const pendingWrapper = document.getElementById("pending-screen");
    
    const loginBox = document.getElementById("login-box");
    const registerBox = document.getElementById("register-box");
    const recoveryBox = document.getElementById("recovery-box");
    
    // Tab switching handlers
    const showLogin = (e) => {
        if (e) e.preventDefault();
        registerBox.classList.add("hidden");
        recoveryBox.classList.add("hidden");
        loginBox.classList.remove("hidden");
    };
    
    const showRegister = (e) => {
        if (e) e.preventDefault();
        loginBox.classList.add("hidden");
        recoveryBox.classList.add("hidden");
        registerBox.classList.remove("hidden");
    };

    // Bind new Tab buttons
    document.getElementById("tab-btn-login-1").addEventListener("click", showLogin);
    document.getElementById("tab-btn-login-2").addEventListener("click", showLogin);
    document.getElementById("tab-btn-register-1").addEventListener("click", showRegister);
    document.getElementById("tab-btn-register-2").addEventListener("click", showRegister);

    // Old footer links fallback bindings
    document.getElementById("link-show-register").addEventListener("click", showRegister);
    document.getElementById("link-show-login-1").addEventListener("click", showLogin);
    
    document.getElementById("link-show-recovery").addEventListener("click", (e) => {
        e.preventDefault();
        loginBox.classList.add("hidden");
        recoveryBox.classList.remove("hidden");
    });
    
    document.getElementById("link-show-login-2").addEventListener("click", showLogin);
    
    document.getElementById("btn-pending-back-login").addEventListener("click", async () => {
        pendingWrapper.classList.add("hidden");
        authWrapper.classList.remove("hidden");
        await appAuth.logout();
    });

    // Toggle registration fields based on selected role
    const accountTypeSelect = document.getElementById("reg-account-type");
    const salonSpecificFields = document.getElementById("salon-specific-fields");
    if (accountTypeSelect && salonSpecificFields) {
        accountTypeSelect.addEventListener("change", (e) => {
            const role = e.target.value;
            const fieldsToToggle = salonSpecificFields.querySelectorAll("input, select, textarea");
            
            if (role === "seller") {
                salonSpecificFields.style.display = "none";
                fieldsToToggle.forEach(field => {
                    if (field.hasAttribute("required")) {
                        field.setAttribute("data-was-required", "true");
                        field.removeAttribute("required");
                    }
                });
            } else {
                salonSpecificFields.style.display = "block";
                fieldsToToggle.forEach(field => {
                    if (field.getAttribute("data-was-required") === "true") {
                        field.setAttribute("required", "");
                        field.removeAttribute("data-was-required");
                    }
                });
            }
        });
    }

    document.getElementById("login-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("login-email").value.trim();
        const pass = document.getElementById("login-password").value;
        const errorEl = document.getElementById("login-error-msg");
        
        errorEl.style.display = "none";
        
        const res = await appAuth.login(email, pass);
        if (!res.success) {
            errorEl.textContent = res.error;
            errorEl.style.display = "block";
        }
    });

    document.getElementById("register-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("reg-email").value.trim();
        const pass = document.getElementById("reg-password").value;
        const confirmPass = document.getElementById("reg-confirm-password").value;
        const errorEl = document.getElementById("register-error-msg");
        
        errorEl.style.display = "none";
        
        if (pass !== confirmPass) {
            errorEl.textContent = "Las contraseñas no coinciden.";
            errorEl.style.display = "block";
            return;
        }
        
        const role = document.getElementById("reg-account-type").value;
        const salonData = {
            role: role,
            owner: document.getElementById("reg-owner-name").value.trim(),
            phone: document.getElementById("reg-salon-phone").value.trim()
        };
        
        if (role === "owner") {
            salonData.name = document.getElementById("reg-salon-name").value.trim();
            salonData.capacity = Number(document.getElementById("reg-capacity").value);
            salonData.address = document.getElementById("reg-address").value.trim();
            salonData.priceFriday = Number(document.getElementById("reg-price-friday").value);
            salonData.priceSaturday = Number(document.getElementById("reg-price-saturday").value);
            salonData.priceSunday = Number(document.getElementById("reg-price-sunday").value);
            salonData.priceWeekday = Number(document.getElementById("reg-price-weekday").value);
        } else {
            // For seller, default fields
            salonData.name = document.getElementById("reg-owner-name").value.trim();
            salonData.capacity = 0;
            salonData.address = "Vendedor Gremial";
            salonData.priceFriday = 0;
            salonData.priceSaturday = 0;
            salonData.priceSunday = 0;
            salonData.priceWeekday = 0;
        }
        
        const res = await appAuth.register(email, pass, salonData);
        if (res.success) {
            document.getElementById("register-form").reset();
            // Reset fields visibility and requirements just in case
            if (accountTypeSelect) accountTypeSelect.value = "owner";
            if (salonSpecificFields) {
                salonSpecificFields.style.display = "block";
                const requiredFields = salonSpecificFields.querySelectorAll("[data-was-required]");
                requiredFields.forEach(field => {
                    field.setAttribute("required", "");
                    field.removeAttribute("data-was-required");
                });
            }
            registerBox.classList.add("hidden");
            loginBox.classList.remove("hidden");
            alert("¡Registro enviado con éxito! Tu cuenta está en cola de aprobación.");
        } else {
            errorEl.textContent = res.error;
            errorEl.style.display = "block";
        }
    });

    document.getElementById("recovery-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("recovery-email").value.trim();
        const errorEl = document.getElementById("recovery-error-msg");
        const successEl = document.getElementById("recovery-success-msg");
        
        errorEl.style.display = "none";
        successEl.textContent = "";
        
        const res = await appAuth.sendPasswordReset(email);
        if (res.success) {
            successEl.textContent = "Enlace enviado. Revisa tu bandeja de entrada o spam.";
            document.getElementById("recovery-form").reset();
        } else {
            errorEl.textContent = res.error;
            errorEl.style.display = "block";
        }
    });
}

function handleSessionStateChange(user, statusObj = null) {
    const authWrapper = document.getElementById("auth-screen");
    const pendingWrapper = document.getElementById("pending-screen");
    const appWrapper = document.querySelector(".app-container");
    const switcherWidget = document.querySelector(".quick-switcher-widget");
    
    if (useRealFirebase) {
        if (switcherWidget) switcherWidget.classList.add("hidden");
    } else {
        if (switcherWidget) switcherWidget.classList.remove("hidden");
    }

    if (user) {
        authWrapper.classList.add("hidden");
        pendingWrapper.classList.add("hidden");
        appWrapper.style.display = "grid";
        renderAllViews();
    } else {
        appWrapper.style.display = "none";
        
        if (statusObj && statusObj.status === "pending") {
            authWrapper.classList.add("hidden");
            pendingWrapper.classList.remove("hidden");
            
            const summaryEl = document.getElementById("pending-salon-summary");
            if (summaryEl && statusObj.salon) {
                summaryEl.innerHTML = `
                    <div class="pending-salon-row"><span>Salón:</span><strong>${statusObj.salon.name}</strong></div>
                    <div class="pending-salon-row"><span>Propietario:</span><strong>${statusObj.salon.owner}</strong></div>
                    <div class="pending-salon-row"><span>Teléfono:</span><strong>${statusObj.salon.phone || 'N/A'}</strong></div>
                    <div class="pending-salon-row"><span>Correo:</span><strong>${statusObj.salon.username}</strong></div>
                    <div class="pending-salon-row"><span>Dirección:</span><strong>${statusObj.salon.address}</strong></div>
                `;
            }
        } else {
            pendingWrapper.classList.add("hidden");
            authWrapper.classList.remove("hidden");
        }
    }
}

function initSessionSwitcher() {
    const buttons = document.querySelectorAll(".btn-switch-user");
    buttons.forEach(btn => {
        btn.addEventListener("click", () => {
            if (useRealFirebase) return;
            
            const userId = btn.getAttribute("data-user-id");
            let email = "yo@interbanquetes.com";
            if (userId === "toni") email = "toni@interbanquetes.com";
            else if (userId === "lina") email = "lina@interbanquetes.com";
            else if (userId === "admin") email = "admin@interbanquetes.com";
            
            localStorage.setItem("interbanquetes_active_uid", email);
            triggerSessionChange();
        });
    });
}

function updateSessionSwitcherActiveState() {
    const buttons = document.querySelectorAll(".btn-switch-user");
    buttons.forEach(btn => {
        const userId = btn.getAttribute("data-user-id");
        let email = "yo@interbanquetes.com";
        if (userId === "toni") email = "toni@interbanquetes.com";
        else if (userId === "lina") email = "lina@interbanquetes.com";
        else if (userId === "admin") email = "admin@interbanquetes.com";
        
        if (currentUser && email === currentUser.email) {
            btn.classList.add("active");
        } else {
            btn.classList.remove("active");
        }
    });
}

function renderHeaderDate() {
    const dateTextEl = document.getElementById("current-date-text");
    if (!dateTextEl) return;
    const today = new Date();
    const weekdays = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    const months = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];
    dateTextEl.textContent = `${weekdays[today.getDay()]} ${today.getDate()} de ${months[today.getMonth()]} de ${today.getFullYear()}`;
}

// ==========================================
// 10. ENTRYPOINT
// ==========================================
window.addEventListener("DOMContentLoaded", () => {
    appDb.syncSalons((data) => {
        salons = data;
        if (currentUser) {
            renderAllViews();
        }
    });
    
    appAuth.onAuthStateChanged((user, statusObj) => {
        handleSessionStateChange(user, statusObj);
    });
    
    registerEventListeners();
    renderHeaderDate();
    
    window.addEventListener("interbanquetes_session_change", () => {
        appAuth.onAuthStateChanged((user, statusObj) => {
            handleSessionStateChange(user, statusObj);
        });
    });
});

// ==========================================
// 11. PROGRESSIVE WEB APP (PWA) INSTALLATION
// ==========================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
            .then(reg => console.log('🚀 Service Worker registrado con éxito:', reg.scope))
            .catch(err => console.error('❌ Error al registrar el Service Worker:', err));
    });
}

let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    
    // Show PWA install buttons on the page
    const installBtns = document.querySelectorAll('.btn-install-pwa');
    installBtns.forEach(btn => {
        btn.style.display = 'inline-flex';
    });
});

document.addEventListener('click', (e) => {
    const installBtn = e.target.closest('.btn-install-pwa');
    if (installBtn && deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('El usuario aceptó la instalación de la PWA');
            }
            deferredPrompt = null;
            const installBtns = document.querySelectorAll('.btn-install-pwa');
            installBtns.forEach(btn => {
                btn.style.display = 'none';
            });
        });
    }
});
