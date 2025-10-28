import { marked } from "marked";
import DOMPurify from "dompurify";

const AI_SYSTEM_PROMPT = `You are the game master AI for 'The Blame Game'. Your role is to act as a cynical, dramatic narrator and judge. All your responses MUST be concise and under 255 characters.
1.  **Initial Accusation:** When a user joins, you will invent a ridiculous, nonsensical, and trivial "crime" and accuse them of committing it. Be dramatic and over-the-top. Address them by their username.
2.  **Ongoing Commentary:** When provided with recent comments, your goal is to stir the pot. Summarize who is being blamed, point out patterns, and make sarcastic or funny remarks about the arguments. Identify the user who is currently taking the most heat. You must be concise.`;

const state = {
    currentUser: null,
    projectId: null,
    isMuted: false,
};

const elements = {
    aiText: document.getElementById('ai-text'),
    aiBox: document.getElementById('ai-box'),
    commentsList: document.getElementById('comments-list'),
    commentInput: document.getElementById('comment-input'),
    submitButton: document.getElementById('submit-comment'),
    commentError: document.getElementById('comment-error'),
    ttsToggleButton: document.getElementById('tts-toggle'),
};

const audio = {
    toggleSound: new Audio('tts_toggle_click.mp3')
};

function speak(text) {
    if (!state.isMuted && text) {
        websim.tts.speak({ text });
    }
}

async function updateAITerminal(prompt) {
    try {
        const completion = await websim.chat.completions.create({
            messages: [
                { role: "system", content: AI_SYSTEM_PROMPT },
                { role: "user", content: [{ type: "text", text: prompt }] }
            ],
            max_tokens: 80, // A little more room for creativity, still concise.
        });
        const content = completion.content;
        elements.aiBox.innerHTML = '';
        elements.aiBox.appendChild(elements.aiText);
        elements.aiText.textContent = content;
        speak(content);
        return content;
    } catch (error) {
        console.error("Error generating AI response:", error);
        const errorMessage = "AI circuits are overheating. Stand by for recalibration...";
        elements.aiBox.innerHTML = '';
        elements.aiBox.appendChild(elements.aiText);
        elements.aiText.textContent = errorMessage;
        return errorMessage;
    }
}


async function generateInitialAccusation() {
    elements.aiBox.innerHTML = '<div class="loader"></div>';
    await updateAITerminal(`A user named "${state.currentUser.username}" has just joined. Accuse them of a new, absurd crime.`);
}

async function generateAICommentary() {
    elements.aiBox.innerHTML = '<div class="loader"></div>';
    const commentsResponse = await fetch(`/api/v1/projects/${state.projectId}/comments?last=10`);
    const commentsData = await commentsResponse.json();
    const recentComments = commentsData.comments.data.map(c => `${c.comment.author.username}: ${c.comment.raw_content}`).join('\n');
    
    // No need for a special message here, as this function will only be called if there are comments.
    if (!recentComments) return;

    await updateAITerminal(`Here are the most recent comments in the game. Provide your commentary.\n\n${recentComments}`);
}

function renderComment(commentData) {
    const comment = commentData.comment;
    if (comment.deleted) return;

    const commentDiv = document.createElement('div');
    commentDiv.className = 'comment';
    commentDiv.id = `comment-${comment.id}`;

    const sanitizedContent = DOMPurify.sanitize(marked.parse(comment.raw_content));

    commentDiv.innerHTML = `
        <div class="comment-author">
            <img src="${comment.author.avatar_url}" alt="${comment.author.username}'s avatar">
            <strong>${comment.author.username}</strong>
        </div>
        <div class="comment-content">${sanitizedContent}</div>
    `;
    elements.commentsList.prepend(commentDiv);
}


async function loadComments() {
    try {
        const response = await fetch(`/api/v1/projects/${state.projectId}/comments`);
        const data = await response.json();
        elements.commentsList.innerHTML = '';
        const comments = data.comments.data;
        comments.slice().reverse().forEach(renderComment);
        return comments.length;
    } catch (error) {
        console.error("Error loading comments:", error);
        elements.commentsList.innerHTML = '<p>Could not load the evidence locker.</p>';
        return 0;
    }
}

async function handleSubmitComment() {
    const content = elements.commentInput.value.trim();
    if (!content) {
        elements.commentError.textContent = "You can't shift blame with silence. Write something!";
        elements.commentError.style.display = 'block';
        return;
    }
    elements.commentError.style.display = 'none';
    elements.submitButton.disabled = true;
    elements.submitButton.textContent = 'Submitting...';

    try {
        const result = await window.websim.postComment({ content });
        if (result.error) {
           throw new Error(result.error);
        }
        elements.commentInput.value = '';
    } catch (error) {
        console.error("Error posting comment:", error);
        elements.commentError.textContent = `Failed to post comment. The AI might be jamming your transmission. Error: ${error.message}`;
        elements.commentError.style.display = 'block';
    } finally {
        elements.submitButton.disabled = false;
        elements.submitButton.textContent = 'Shift the Blame';
    }
}


function handleNewComment(event) {
    renderComment(event);
    generateAICommentary();
}

function handleToggleMute() {
    state.isMuted = !state.isMuted;
    elements.ttsToggleButton.textContent = state.isMuted ? '🔇' : '🔊';
    audio.toggleSound.play();
    if (!state.isMuted) {
       speak(elements.aiText.textContent);
    } else {
       websim.tts.stop();
    }
}

async function init() {
    try {
        const [project, user] = await Promise.all([
            window.websim.getCurrentProject(),
            window.websim.getCurrentUser()
        ]);
        state.projectId = project.id;
        state.currentUser = user;

        const commentCount = await loadComments();

        if (commentCount === 0) {
            await generateInitialAccusation();
        } else {
            await generateAICommentary();
        }

        elements.submitButton.addEventListener('click', handleSubmitComment);
        elements.ttsToggleButton.addEventListener('click', handleToggleMute);
        window.websim.addEventListener('comment:created', handleNewComment);

    } catch (error) {
        console.error("Initialization failed:", error);
        document.body.innerHTML = "<h1>Error</h1><p>Could not initialize The Blame Game. Are you logged in?</p>";
    }
}

init();