import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
    getFirestore,
    collection,
    addDoc,
    query,
    orderBy,
    onSnapshot,
    serverTimestamp,
    deleteDoc,
    doc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
    getAuth,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBfwZAWz_ZA8k1tMIXnZMOCZ_OKElXdZ5Y",
  authDomain: "chating-4f317.firebaseapp.com",
  projectId: "chating-4f317",
  storageBucket: "chating-4f317.firebasestorage.app",
  messagingSenderId: "774716815154",
  appId: "1:774716815154:web:ea71d220845e257951892b",
  measurementId: "G-JRBNH34DD3"
};
// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let currentUser = null;
let unsubscribe = null;

// Both authorised Firebase user UIDs
const ALLOWED_USERS = [
    "3WhYWGiPqPWxSD6l13MgeS2RZZV2",
    "5JRvSxFaNVhVk92hrgrh45hVrYF3"
];

const loginPage = document.getElementById("loginPage");
const chatPage = document.getElementById("chatPage");
const messagesBox = document.getElementById("messages");

function isAllowedUser(uid) {
    return ALLOWED_USERS.includes(uid);
}

// Login
window.login = async function () {
    const id = document.getElementById("userId").value.trim();
    const password = document.getElementById("password").value;
    const errorBox = document.getElementById("error");

    errorBox.textContent = "";

    if (!id || !password) {
        errorBox.textContent = "Please enter email and password.";
        return;
    }

    try {
        const result = await signInWithEmailAndPassword(
            auth,
            id,
            password
        );

        currentUser = result.user;

        if (!isAllowedUser(currentUser.uid)) {
            await signOut(auth);
            currentUser = null;
            errorBox.textContent = "You are not authorised to use this chat.";
            return;
        }

        loginPage.style.display = "none";
        chatPage.style.display = "flex";

        document.getElementById("welcomeUser").textContent =
            currentUser.email || "User";

        loadMessages();

    } catch (error) {
        console.error("LOGIN ERROR:", error);
        errorBox.textContent = error.code + ": " + error.message;
    }
};

// Delete message for everyone
async function deleteMessage(messageId) {
    if (!currentUser || !isAllowedUser(currentUser.uid)) {
        alert("You are not authorised.");
        return;
    }

    const confirmed = window.confirm(
        "Delete this message for everyone?"
    );

    if (!confirmed) return;

    try {
        await deleteDoc(doc(db, "messages", messageId));
        // onSnapshot automatically updates both users' screens.
    } catch (error) {
        console.error("DELETE ERROR:", error);
        alert("Message could not be deleted: " + error.message);
    }
}

// Load messages in real time
function loadMessages() {
    if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
    }

    const q = query(
        collection(db, "messages"),
        orderBy("createdAt", "asc")
    );

    unsubscribe = onSnapshot(
        q,
        (snapshot) => {
            messagesBox.innerHTML = "";

            snapshot.forEach((messageDoc) => {
                const data = messageDoc.data();
                const messageId = messageDoc.id;

                const div = document.createElement("div");

                div.className =
                    "message " +
                    (data.sender === currentUser.uid
                        ? "sent"
                        : "received");

                const messageText = document.createElement("div");
                messageText.className = "message-text";
                messageText.textContent = data.text || "";

                const time = document.createElement("small");
                time.className = "message-time";

                time.textContent = data.createdAt
                    ? data.createdAt.toDate().toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit"
                    })
                    : "Sending...";

                div.append(messageText, time);

                // Desktop: right-click to delete
                div.addEventListener("contextmenu", (event) => {
                    event.preventDefault();

                    if (div.dataset.longPressed === "true") {
                        div.dataset.longPressed = "false";
                        return;
                    }

                    deleteMessage(messageId);
                });

                // Mobile: long press to delete
                let pressTimer = null;

                div.addEventListener("touchstart", () => {
                    clearTimeout(pressTimer);

                    pressTimer = setTimeout(() => {
                        div.dataset.longPressed = "true";
                        deleteMessage(messageId);
                    }, 650);
                }, { passive: true });

                div.addEventListener("touchend", () => {
                    clearTimeout(pressTimer);
                });

                div.addEventListener("touchmove", () => {
                    clearTimeout(pressTimer);
                });

                div.addEventListener("touchcancel", () => {
                    clearTimeout(pressTimer);
                });

                messagesBox.appendChild(div);
            });

            messagesBox.scrollTop = messagesBox.scrollHeight;
        },
        (error) => {
            console.error("MESSAGE LOADING ERROR:", error);
            alert("Loading failed: " + error.message);
        }
    );
}

// Send message
window.sendMessage = async function () {
    const input = document.getElementById("messageInput");
    const text = input.value.trim();

    if (!text || !currentUser) return;

    if (!isAllowedUser(currentUser.uid)) {
        alert("You are not authorised.");
        return;
    }

    input.disabled = true;

    try {
        await addDoc(collection(db, "messages"), {
            sender: currentUser.uid,
            text: text,
            createdAt: serverTimestamp()
        });

        input.value = "";

    } catch (error) {
        console.error("SEND ERROR:", error);
        alert("Message could not be sent: " + error.message);

    } finally {
        input.disabled = false;
        input.focus();
    }
};

// Enter key to send
document.getElementById("messageInput")
    .addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            window.sendMessage();
        }
    });

// Logout
window.logout = async function () {
    if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
    }

    try {
        await signOut(auth);
    } catch (error) {
        console.error("LOGOUT ERROR:", error);
    }

    currentUser = null;
    messagesBox.innerHTML = "";

    chatPage.style.display = "none";
    loginPage.style.display = "flex";
};
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
