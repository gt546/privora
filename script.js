// PRIVORA PRIVATE CHAT
// Firebase SDK 10.12.2

import { initializeApp } from
"https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from
"https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    getDatabase,
    ref,
    get,
    set,
    push,
    onValue,
    remove,
    serverTimestamp
} from
"https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";


// FIREBASE CONFIGURATION
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

// INITIALIZE FIREBASE

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const db = getDatabase(app);


// HTML ELEMENTS

const authSection =
document.getElementById("authSection");

const chatSection =
document.getElementById("chatSection");

const authForm =
document.getElementById("authForm");

const emailInput =
document.getElementById("emailInput");

const passwordInput =
document.getElementById("passwordInput");

const signupBtn =
document.getElementById("signupBtn");

const logoutBtn =
document.getElementById("logoutBtn");

const authMessage =
document.getElementById("authMessage");

const myUidElement =
document.getElementById("myUid");

const copyUidBtn =
document.getElementById("copyUidBtn");

const openChatForm =
document.getElementById("openChatForm");

const friendUidInput =
document.getElementById("friendUidInput");

const chatTitle =
document.getElementById("chatTitle");

const chatHint =
document.getElementById("chatHint");

const messagesElement =
document.getElementById("messages");

const sendForm =
document.getElementById("sendForm");

const messageInput =
document.getElementById("messageInput");

const sendBtn =
document.getElementById("sendBtn");

const chatMessage =
document.getElementById("chatMessage");


// GLOBAL VARIABLES

let currentUser = null;

let currentChatId = null;

let currentFriendUid = null;

let stopMessagesListener = null;


// SHOW MESSAGE

function showMessage(element, text, isError = true) {

    element.textContent = text;

    element.style.color = isError
        ? "#a33e54"
        : "#26804b";
}


// CREATE COMMON CHAT ID

function makeChatId(uidA, uidB) {

    return [uidA, uidB].sort().join("__");

}


// CLEAR CHAT SCREEN

function clearMessages(text = "Your messages will appear here.") {

    messagesElement.replaceChildren();

    const empty = document.createElement("div");

    empty.className = "empty-state";

    empty.textContent = text;

    messagesElement.appendChild(empty);

}


// FORMAT TIME

function formatTime(timestamp) {

    if (!timestamp) return "Sending...";

    return new Date(timestamp).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });

}


// RENDER MESSAGES

function renderMessages(snapshot) {

    messagesElement.replaceChildren();

    if (!snapshot.exists()) {

        clearMessages("No messages yet. Say hello!");

        return;
    }

    snapshot.forEach((childSnapshot) => {

        const message = childSnapshot.val();

        const messageId = childSnapshot.key;

        const row = document.createElement("div");

        const mine =
            message.senderUid === currentUser.uid;

        row.className =
            `message-row ${mine ? "mine" : "theirs"}`;

        const bubble = document.createElement("div");

        bubble.className = "message-bubble";

        const text = document.createElement("div");

        text.className = "message-text";

        text.textContent = message.text || "";

        const meta = document.createElement("div");

        meta.className = "message-meta";

        const time = document.createElement("span");

        time.textContent = formatTime(message.createdAt);

        const sender = document.createElement("span");

        sender.textContent = mine ? "You" : "Friend";

        meta.append(sender, time);

        // DELETE BUTTON

        const deleteButton =
            document.createElement("button");

        deleteButton.type = "button";

        deleteButton.className = "delete-message";

        deleteButton.textContent = "Delete";

        deleteButton.addEventListener("click", () => {

            deleteMessage(messageId);

        });

        meta.appendChild(deleteButton);

        bubble.append(text, meta);

        row.appendChild(bubble);

        messagesElement.appendChild(row);

    });

    messagesElement.scrollTop =
        messagesElement.scrollHeight;

}


// OPEN CHAT

async function openChat(friendUid) {

    const otherUid = friendUid.trim();

    if (!currentUser) return;

    if (!otherUid) {

        showMessage(
            chatMessage,
            "Enter your friend's User ID."
        );

        return;
    }

    if (otherUid === currentUser.uid) {

        showMessage(
            chatMessage,
            "You cannot chat with yourself."
        );

        return;
    }

    if (stopMessagesListener) {

        stopMessagesListener();

        stopMessagesListener = null;

    }

    currentFriendUid = otherUid;

    currentChatId =
        makeChatId(currentUser.uid, otherUid);

    chatTitle.textContent = "Private Conversation";

    chatHint.textContent =
        `Chat with User ID: ${otherUid}`;

    clearMessages("Connecting to chat...");

    messageInput.disabled = true;

    sendBtn.disabled = true;

    const membersRef = ref(
        db,
        `chats/${currentChatId}/members`
    );

    try {

        // CREATE TWO-MEMBER CHAT

        try {

            await set(membersRef, {

                [currentUser.uid]: true,

                [otherUid]: true

            });

        } catch (createError) {

            let retrySnapshot = null;

            for (let attempt = 0; attempt < 4; attempt++) {

                try {

                    retrySnapshot = await get(membersRef);

                    if (retrySnapshot.exists()) break;

                } catch (readError) {

                    if (attempt === 3) {
                        throw createError;
                    }

                }

                await new Promise(resolve =>
                    setTimeout(resolve, 350)
                );

            }

            if (!retrySnapshot || !retrySnapshot.exists()) {
                throw createError;
            }

        }


        // VERIFY CHAT MEMBERS

        const verifiedMembers =
            await get(membersRef);

        const members =
            verifiedMembers.val() || {};

        if (
            members[currentUser.uid] !== true ||
            members[otherUid] !== true
        ) {

            throw new Error(
                "This chat is not available to these accounts."
            );

        }


        // LISTEN TO MESSAGES

        const messagesRef = ref(
            db,
            `chats/${currentChatId}/messages`
        );

        stopMessagesListener = onValue(
            messagesRef,
            renderMessages,
            (error) => {

                clearMessages("Could not load messages.");

                showMessage(chatMessage, error.message);

            }
        );


        messageInput.disabled = false;

        sendBtn.disabled = false;

        showMessage(
            chatMessage,
            "Chat connected. Messages are saved automatically.",
            false
        );

        messageInput.focus();

    } catch (error) {

        console.error("Open chat error:", error);

        clearMessages("Unable to open this chat.");

        showMessage(
            chatMessage,
            error.message
        );

    }

}


// SEND MESSAGE

async function sendMessage(text) {

    if (
        !currentUser ||
        !currentChatId ||
        !currentFriendUid
    ) {

        throw new Error("Open a friend's chat first.");

    }

    const cleanText = text.trim();

    if (!cleanText) return;

    const messagesRef = ref(
        db,
        `chats/${currentChatId}/messages`
    );

    const newMessageRef = push(messagesRef);

    await set(newMessageRef, {

        senderUid: currentUser.uid,

        text: cleanText,

        createdAt: serverTimestamp()

    });

}


// DELETE MESSAGE FOR BOTH USERS

async function deleteMessage(messageId) {

    if (!currentChatId || !messageId) return;

    const confirmed = confirm(
        "Delete this message for both users?"
    );

    if (!confirmed) return;

    try {

        await remove(
            ref(
                db,
                `chats/${currentChatId}/messages/${messageId}`
            )
        );

        showMessage(
            chatMessage,
            "Message deleted for both users.",
            false
        );

    } catch (error) {

        console.error("Delete error:", error);

        showMessage(chatMessage, error.message);

    }

}


// LOGIN

authForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    showMessage(authMessage, "Signing in...", false);

    try {

        await signInWithEmailAndPassword(
            auth,
            emailInput.value.trim(),
            passwordInput.value
        );

    } catch (error) {

        showMessage(authMessage, error.message);

    }

});


// SIGNUP

signupBtn.addEventListener("click", async () => {

    showMessage(authMessage, "Creating account...", false);

    try {

        await createUserWithEmailAndPassword(
            auth,
            emailInput.value.trim(),
            passwordInput.value
        );

    } catch (error) {

        showMessage(authMessage, error.message);

    }

});


// LOGOUT

logoutBtn.addEventListener("click", async () => {

    try {

        await signOut(auth);

    } catch (error) {

        showMessage(chatMessage, error.message);

    }

});


// COPY USER ID

copyUidBtn.addEventListener("click", async () => {

    if (!currentUser) return;

    try {

        await navigator.clipboard.writeText(
            currentUser.uid
        );

        showMessage(
            chatMessage,
            "Your User ID copied.",
            false
        );

    } catch {

        showMessage(
            chatMessage,
            "Copy failed. Copy your User ID manually."
        );

    }

});


// OPEN CHAT BUTTON

openChatForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    await openChat(friendUidInput.value);

});


// SEND BUTTON

sendForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    const text = messageInput.value;

    if (!text.trim()) return;

    sendBtn.disabled = true;

    try {

        await sendMessage(text);

        messageInput.value = "";

        showMessage(
            chatMessage,
            "Message sent.",
            false
        );

        messageInput.focus();

    } catch (error) {

        console.error("Send error:", error);

        showMessage(chatMessage, error.message);

    } finally {

        sendBtn.disabled = !currentChatId;

    }

});


// AUTH STATE

onAuthStateChanged(auth, (user) => {

    currentUser = user;

    if (user) {

        authSection.classList.add("hidden");

        chatSection.classList.remove("hidden");

        logoutBtn.classList.remove("hidden");

        myUidElement.textContent = user.uid;

        showMessage(
            chatMessage,
            "Signed in. Share your User ID with a friend.",
            false
        );

    } else {

        if (stopMessagesListener) {

            stopMessagesListener();

            stopMessagesListener = null;

        }

        currentChatId = null;

        currentFriendUid = null;

        chatSection.classList.add("hidden");

        logoutBtn.classList.add("hidden");

        authSection.classList.remove("hidden");

        myUidElement.textContent = "";

        messageInput.value = "";

        messageInput.disabled = true;

        sendBtn.disabled = true;

        clearMessages();

        showMessage(authMessage, "");

    }

});
