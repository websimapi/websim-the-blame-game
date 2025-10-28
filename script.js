import { marked } from "marked";
import DOMPurify from "dompurify";

const AI_SYSTEM_PROMPT = `You are the game master AI for 'The Blame Game'. Your role is to act as a cynical, dramatic narrator and judge.
1.  **Initial Accusation:** When the game starts, you will invent a ridiculous, nonsensical, and trivial "crime" and accuse the current user of committing it. Be dramatic and over-the-top. Address them by their username.
2.  **Ongoing Commentary:** After the initial accusation, you will analyze new comments. Your goal is to stir the pot. Summarize who is being blamed, point out patterns, and make sarcastic or funny remarks about the arguments. Identify the user who is currently taking the most heat. You must be concise.`;

const state = {
    currentUser: null,
    projectId: null,
};

const elements = {
    accusationText: document.getElementById('ai-accusation-text'),
    accusationBox: document.getElementById('ai-accusation-box'),
    commentaryText: document.getElementById('ai-commentary-text'),
    commentsList: document.getElementById('comments-list'),
    commentInput: document.getElementById('comment-input'),
    submitButton: document.getElementById('submit-comment'),
    commentError: document.getElementById('comment-error'),
};

async function generateInitialAccusation() {
    elements.accusationBox.innerHTML = '<div class="loader"></div>';
    try {
        const completion = await websim.chat.completions.create({
            messages: [
                { role: "system", content: AI_SYSTEM_PROMPT },
                { role: "user", content: `A user named "${state.currentUser.username}" has just joined. Accuse them of a new, absurd crime.` }
            ],
        });
        elements.accusationText.textContent = completion.content;
    } catch (error) {
        console.error("Error generating AI accusation:", error);
        elements.accusationText.textContent = "The AI's accusation circuits have shorted out. You're lucky... for now.";
    } finally {
        elements.accusationBox.innerHTML = '';
        elements.accusationBox.appendChild(elements.accusationText);
    }
}

async function generateAICommentary() {
    try {
        const commentsResponse = await fetch(`/api/v1/projects/${state.projectId}/comments?last=10`);
        const commentsData = await commentsResponse.json();
        const recentComments = commentsData.comments.data.map(c => `${c.comment.author.username}: ${c.comment.raw_content}`).join('\n');
        
        if (!recentComments) {
            elements.commentaryText.textContent = "The void is silent. No one is casting blame. How peculiar.";
            return;
        }

        const completion = await websim.chat.completions.create({
            messages: [
                { role: "system", content: AI_SYSTEM_PROMPT },
                { role: "user", content: `Here are the most recent comments in the game. Provide your commentary.\n\n${recentComments}` }
            ],
        });
        elements.commentaryText.textContent = completion.content;
    } catch (error) {
        console.error("Error generating AI commentary:", error);
        elements.commentaryText.textContent = "The AI is struggling to process the sheer volume of blame...";
    }
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
        data.comments.data.reverse().forEach(renderComment);
    } catch (error) {
        console.error("Error loading comments:", error);
        elements.commentsList.innerHTML = '<p>Could not load the evidence locker.</p>';
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

async function init() {
    try {
        const [project, user] = await Promise.all([
            window.websim.getCurrentProject(),
            window.websim.getCurrentUser()
        ]);
        state.projectId = project.id;
        state.currentUser = user;

        await generateInitialAccusation();
        await loadComments();
        await generateAICommentary(); // Initial commentary

        elements.submitButton.addEventListener('click', handleSubmitComment);
        window.websim.addEventListener('comment:created', handleNewComment);

    } catch (error) {
        console.error("Initialization failed:", error);
        document.body.innerHTML = "<h1>Error</h1><p>Could not initialize The Blame Game. Are you logged in?</p>";
    }
}

init();

