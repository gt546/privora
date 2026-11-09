// ==========================================
// PRIVORA - COMPLETE FIREBASE CHAT SYSTEM
// ==========================================


// 1. FIREBASE IMPORTS

import { initializeApp } from
"https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
    getAuth,
    signInWithEmailAndPassword,
    signOut
} from
"https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

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
} from
"https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
    getDatabase,
    ref,
    onValue,
    onDisconnect,
    set,
    serverTimestamp as rtdbTimestamp
} from
"https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";


// ==========================================
// 2. FIREBASE CONFIGURATION
// ==========================================

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBfwZAWz_ZA8k1tMIXnZMOCZ_OKElXdZ5Y",
  authDomain: "chating-4f317.firebaseapp.com",
  databaseURL: "https://chating-4f317-default-rtdb.firebaseio.com",
  projectId: "chating-4f317",
  storageBucket: "chating-4f317.firebasestorage.app",
  messagingSenderId: "774716815154",
  appId: "1:774716815154:web:b85a2dfaf455932b51892b",
  measurementId: "G-WXZ1JB32E8"
};


// ==========================================
// 3. INITIALIZE FIREBASE
// ==========================================

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const db = getFirestore(app);

const rtdb = getDatabase(
    app,
    firebaseConfig.databaseURL
);


// ==========================================
// 4. GLOBAL VARIABLES
// ==========================================

let currentUser = null;

let unsubscribe = null;

let stopStatusListener = null;

let stopConnectionListener = null;


// ==========================================
// 5. AUTHORIZED USERS
// ==========================================

const ALLOWED_USERS = [

    "3WhYWGiPqPWxSD6l13MgeS2RZZV2",

    "5JRvSxFaNVhVk92hrgrh45hVrYF3"

];


const OTHER_USER = {

    "3WhYWGiPqPWxSD6l13MgeS2RZZV2":
        "5JRvSxFaNVhVk92hrgrh45hVrYF3",

    "5JRvSxFaNVhVk92hrgrh45hVrYF3":
        "3WhYWGiPqPWxSD6l13MgeS2RZZV2"

};


// ==========================================
// 6. HTML ELEMENTS
// ==========================================

const loginPage = document.getElementById("loginPage");

const chatPage = document.getElementById("chatPage");

const messagesBox = document.getElementById("messages");

const errorBox = document.getElementById("error");

const messageInput = document.getElementById("messageInput");

const onlineLight = document.getElementById("onlineLight");

const onlineText = document.getElementById("onlineText");


function isAllowedUser(uid) {

    return ALLOWED_USERS.includes(uid);

}


// ==========================================
// 7. LOGIN FUNCTION
// ==========================================

window.login = async function () {

    const email =
        document.getElementById("userId").value.trim();

    const password =
        document.getElementById("password").value;

    if (errorBox) {
        errorBox.textContent = "";
    }

    if (!email || !password) {

        errorBox.textContent =
            "Please enter email and password.";

        return;

    }

    const loginBtn =
        document.getElementById("loginBtn") ||
        loginPage.querySelector("button");

    if (loginBtn) {

        loginBtn.disabled = true;

        loginBtn.textContent = "Logging in...";

    }

    try {

        const result =
            await signInWithEmailAndPassword(
                auth,
                email,
                password
            );

        currentUser = result.user;

        // Check authorized user

        if (!isAllowedUser(currentUser.uid)) {

            await signOut(auth);

            currentUser = null;

            errorBox.textContent =
                "You are not authorised to use this chat.";

            return;

        }

        // Show chat page

        loginPage.hidden = true;

        chatPage.hidden = false;

        document.getElementById("welcomeUser").textContent =
            currentUser.email || "User";

        // Load chat and presence

        loadMessages();

        startPresence();

        console.log("PRIVORA LOGIN SUCCESS");

    }

    catch (error) {

        console.error("LOGIN ERROR:", error);

        errorBox.textContent =
            error.code + ": " + error.message;

    }

    finally {

        if (loginBtn) {

            loginBtn.disabled = false;

            loginBtn.textContent = "Login";

        }

    }

};


// ==========================================
// 8. LOAD REAL-TIME MESSAGES
// ==========================================

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

                const div =
                    document.createElement("div");

                div.className =
                    "message " +
                    (data.sender === currentUser.uid
                        ? "sent"
                        : "received");


                // Message text

                const messageText =
                    document.createElement("div");

                messageText.className = "message-text";

                messageText.textContent =
                    data.text || "";


                // Message time

                const time =
                    document.createElement("small");

                time.className = "message-time";

                time.textContent =
                    data.createdAt &&
                    typeof data.createdAt.toDate === "function"

                    ? data.createdAt.toDate().toLocaleTimeString(
                        [],
                        {
                            hour: "2-digit",
                            minute: "2-digit"
                        }
                    )

                    : "Sending...";


                div.append(messageText, time);


                // Desktop right-click delete

                div.addEventListener(
                    "contextmenu",
                    (event) => {

                        event.preventDefault();

                        if (
                            div.dataset.longPressed === "true"
                        ) {

                            div.dataset.longPressed = "false";

                            return;

                        }

                        deleteMessage(messageId);

                    }
                );


                // Mobile long press delete

                let pressTimer = null;

                div.addEventListener(
                    "touchstart",
                    () => {

                        clearTimeout(pressTimer);

                        pressTimer = setTimeout(() => {

                            div.dataset.longPressed = "true";

                            deleteMessage(messageId);

                        }, 650);

                    },
                    { passive: true }
                );


                ["touchend", "touchmove", "touchcancel"]
                    .forEach((eventName) => {

                        div.addEventListener(
                            eventName,
                            () => {

                                clearTimeout(pressTimer);

                            }
                        );

                    });


                messagesBox.appendChild(div);

            });


            messagesBox.scrollTop =
                messagesBox.scrollHeight;

        },


        (error) => {

            console.error(
                "MESSAGE LOADING ERROR:",
                error
            );

            alert(
                "Loading failed: " + error.message
            );

        }

    );

}


// ==========================================
// 9. DELETE MESSAGE FOR EVERYONE
// ==========================================

async function deleteMessage(messageId) {

    if (
        !currentUser ||
        !isAllowedUser(currentUser.uid)
    ) {

        alert("You are not authorised.");

        return;

    }

    const confirmed = window.confirm(
        "Delete this message for everyone?"
    );

    if (!confirmed) return;

    try {

        await deleteDoc(
            doc(db, "messages", messageId)
        );

        console.log("MESSAGE DELETED");

    }

    catch (error) {

        console.error("DELETE ERROR:", error);

        alert(
            "Message could not be deleted: " +
            error.message
        );

    }

}


// ==========================================
// 10. SEND MESSAGE
// ==========================================

window.sendMessage = async function () {

    const text = messageInput.value.trim();

    if (!text || !currentUser) return;

    if (!isAllowedUser(currentUser.uid)) {

        alert("You are not authorised.");

        return;

    }

    messageInput.disabled = true;

    try {

        await addDoc(

            collection(db, "messages"),

            {

                sender: currentUser.uid,

                text: text,

                createdAt: serverTimestamp()

            }

        );

        messageInput.value = "";

    }

    catch (error) {

        console.error("SEND ERROR:", error);

        alert(
            "Message could not be sent: " +
            error.message
        );

    }

    finally {

        messageInput.disabled = false;

        messageInput.focus();

    }

};


// ==========================================
// 11. ONLINE / OFFLINE PRESENCE
// ==========================================

async function startPresence() {

    if (!currentUser) return;

    const uid = currentUser.uid;

    const myStatusRef =
        ref(rtdb, "status/" + uid);

    const connectedRef =
        ref(rtdb, ".info/connected");


    // Stop old listeners

    if (stopStatusListener) {

        stopStatusListener();

        stopStatusListener = null;

    }

    if (stopConnectionListener) {

        stopConnectionListener();

        stopConnectionListener = null;

    }


    // Check Firebase connection

    stopConnectionListener = onValue(

        connectedRef,

        async (snapshot) => {

            if (snapshot.val() !== true) {

                return;

            }

            try {

                // Automatically set offline
                // if connection is disconnected

                await onDisconnect(myStatusRef).set({

                    state: "offline",

                    lastChanged: rtdbTimestamp()

                });


                // Set online

                await set(myStatusRef, {

                    state: "online",

                    lastChanged: rtdbTimestamp()

                });

                console.log("PRESENCE ONLINE");

            }

            catch (error) {

                console.error(
                    "PRESENCE ERROR:",
                    error
                );

            }

        }

    );


    // Get other user UID

    const otherUID = OTHER_USER[uid];

    if (!otherUID) return;


    // Listen to other user's status

    stopStatusListener = onValue(

        ref(rtdb, "status/" + otherUID),

        (snapshot) => {

            const data = snapshot.val();

            const online =
                data?.state === "online";


            onlineLight.className =
                "status-light " +
                (online ? "online" : "offline");


            onlineText.textContent =
                online ? "Online" : "Offline";

        }

    );

}


// ==========================================
// 12. LOGOUT
// ==========================================

window.logout = async function () {

    // Stop listeners

    if (stopConnectionListener) {

        stopConnectionListener();

        stopConnectionListener = null;

    }

    if (stopStatusListener) {

        stopStatusListener();

        stopStatusListener = null;

    }

    if (unsubscribe) {

        unsubscribe();

        unsubscribe = null;

    }


    // Set offline before logout

    try {

        if (currentUser) {

            await set(

                ref(
                    rtdb,
                    "status/" + currentUser.uid
                ),

                {

                    state: "offline",

                    lastChanged: rtdbTimestamp()

                }

            );

        }

    }

    catch (error) {

        console.error(
            "OFFLINE STATUS ERROR:",
            error
        );

    }


    // Firebase logout

    try {

        await signOut(auth);

    }

    catch (error) {

        console.error("LOGOUT ERROR:", error);

    }


    // Reset application

    currentUser = null;

    messagesBox.innerHTML = "";

    loginPage.hidden = false;

    chatPage.hidden = true;

    onlineLight.className =
        "status-light offline";

    onlineText.textContent = "Offline";

    document.getElementById("password").value = "";

    console.log("PRIVORA LOGOUT SUCCESS");

};


// ==========================================
// 13. BUTTON EVENT HANDLERS
// Supports both HTML onclick and button IDs
// ==========================================

function bindButton(selector, handler) {

    const button = document.querySelector(selector);

    if (!button) return;

    // Avoid duplicate events if HTML already has onclick

    if (!button.hasAttribute("onclick")) {

        button.addEventListener("click", handler);

    }

}


// Login button

bindButton(
    "#loginBtn, #loginPage button",
    window.login
);


// Logout button

bindButton(
    "#logoutBtn, .logout",
    window.logout
);


// Send button

bindButton(
    "#sendBtn, .message-input button",
    window.sendMessage
);


// ==========================================
// 14. ENTER KEY TO SEND MESSAGE
// ==========================================

messageInput.addEventListener(
    "keydown",
    (event) => {

        if (
            event.key === "Enter" &&
            !event.shiftKey
        ) {

            event.preventDefault();

            window.sendMessage();

        }

    }
);


// ==========================================
// 15. INITIAL PAGE STATE
// ==========================================

loginPage.hidden = false;

chatPage.hidden = true;

console.log(
    "PRIVORA INITIALIZED SUCCESSFULLY"
);