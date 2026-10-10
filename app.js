
const sampleItems = [
    {
        id: 1,
        name: "Wireless Earbuds",
        category: "Electronics",
        location: "Central Library",
        date: "2026-10-09",
        description: "Black earbuds in a small charging case.",
        status: "lost",
        icon: "🎧",
        returned: false
    },
    {
        id: 2,
        name: "Student Notebook",
        category: "Books",
        location: "Block A, Room 204",
        date: "2026-10-08",
        description: "Blue notebook with handwritten class notes.",
        status: "found",
        icon: "📓",
        returned: false
    },
    {
        id: 3,
        name: "Water Bottle",
        category: "Other",
        location: "College Canteen",
        date: "2026-10-07",
        description: "Silver stainless-steel water bottle.",
        status: "found",
        icon: "🥤",
        returned: true
    },
    {
        id: 4,
        name: "College ID Card",
        category: "ID Cards",
        location: "Main Building",
        date: "2026-10-09",
        description: "Student ID card found near the entrance.",
        status: "found",
        icon: "🪪",
        returned: false
    },
    {
        id: 5,
        name: "Laptop Bag",
        category: "Bags",
        location: "Computer Lab",
        date: "2026-10-06",
        description: "Dark backpack left near a lab desk.",
        status: "lost",
        icon: "🎒",
        returned: false
    },
    {
        id: 6,
        name: "Silver Keychain",
        category: "Accessories",
        location: "Sports Ground",
        date: "2026-10-08",
        description: "A small keychain with two keys.",
        status: "lost",
        icon: "🔑",
        returned: false
    }
];


const API_URL = "http://127.0.0.1:8000";

let items = [...sampleItems];
let nextId = 7;
let currentStatus = "lost";

const itemGrid = document.getElementById("item-grid");
const searchInput = document.getElementById("search-input");
const categoryFilter = document.getElementById("category-filter");
const statusFilter = document.getElementById("status-filter");
const reportModal = document.getElementById("report-modal");
const reportForm = document.getElementById("report-form");

function formatDate(dateString) {
    if (!dateString) return "Date not provided";

    const date = new Date(dateString + "T00:00:00");

    if (Number.isNaN(date.getTime())) {
        return "Date not provided";
    }

    return date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric"
    });
}

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}

function updateStatistics() {
    document.getElementById("total-items").textContent =
        items.length;

    document.getElementById("lost-count").textContent =
        items.filter(item =>
            item.status === "lost" && !item.returned
        ).length;

    document.getElementById("found-count").textContent =
        items.filter(item =>
            item.status === "found" && !item.returned
        ).length;

    document.getElementById("returned-count").textContent =
        items.filter(item => item.returned).length;
}

async function loadItems() {
    try {
        const response = await fetch(`${API_URL}/items`);

        if (!response.ok) {
            throw new Error("Failed to load items");
        }

        const databaseItems = await response.json();

        items = databaseItems.map(item => ({
            ...item,
            status: item.status.toLowerCase(),
            returned: Boolean(item.returned),
            icon: ({
                "Electronics": "🎧",
                "ID Cards": "🪪",
                "Bags": "🎒",
                "Books": "📚",
                "Accessories": "🔑",
                "Other": "📦"
            })[item.category] || "📦"
        }));

        renderItems();
        updateStatistics();

    } catch (error) {
        console.error("Could not load database items:", error);
        showToast("Could not connect to the backend.");
    }
}

function renderItems() {
    const searchTerm = searchInput.value.trim().toLowerCase();
    const category = categoryFilter.value;
    const status = statusFilter.value;

    const filteredItems = items.filter(item => {
        const searchableText = [
            item.name,
            item.category,
            item.location,
            item.description
        ].join(" ").toLowerCase();

        const matchesSearch = searchableText.includes(searchTerm);
        const matchesCategory =
            category === "all" || item.category === category;
        const matchesStatus =
            status === "all" || item.status === status;

        return matchesSearch && matchesCategory && matchesStatus;
    });

    if (filteredItems.length === 0) {
        itemGrid.innerHTML = `
            <p class="empty-message">
                No matching reports found. Try another search.
            </p>
        `;
        return;
    }

    itemGrid.innerHTML = filteredItems.map(item => `
        <article class="item-card">
            <div class="item-visual">
                <span class="status-badge ${item.status}">
                    ${item.status === "lost" ? "LOST" : "FOUND"}
                </span>
                <span aria-hidden="true">${escapeHTML(item.icon || "📦")}</span>
            </div>

            <div class="item-details">
                <span class="item-category">
                    ${escapeHTML(item.category)}
                </span>

                <h3>${escapeHTML(item.name)}</h3>

                <p>${escapeHTML(item.description)}</p>

                <p>📍 ${escapeHTML(item.location)}</p>
                <p>📅 ${escapeHTML(formatDate(item.date))}</p>

                
<div class="item-footer">
    <span>${item.returned ? "Returned" : "Open report"}</span>

    <button onclick="showItemDetails(${item.id})">
        View details →
    </button>

    <button onclick="showMatches(${item.id})">
        Find Possible Matches
    </button>

    
</div>

            </div>
        </article>
    `).join("");
}

function showReportForm(status) {
    currentStatus = status;

    document.getElementById("form-title").textContent =
        status === "lost" ? "Report a Lost Item" : "Report a Found Item";

    reportModal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
}

function closeReportForm() {
    reportModal.classList.add("hidden");
    document.body.style.overflow = "";
}

function showToast(message) {
    const toast = document.getElementById("toast");

    toast.textContent = message;
    toast.classList.add("show");

    window.setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}

function showItemDetails(id) {
    const item = items.find(entry => entry.id === id);

    if (!item) return;

    alert(
        `Item: ${item.name}\n` +
        `Status: ${item.status.toUpperCase()}\n` +
        `Category: ${item.category}\n` +
        `Location: ${item.location}\n` +
        `Date: ${formatDate(item.date)}\n` +
        `Description: ${item.description}\n\n` +
        (item.returned
            ? "This item has been marked as returned."
            : "This is a sample listing. The claim and contact workflow will be added in a later stage.")
    );
}


async function showMatches(itemId) {
    const panel = document.getElementById("matches-panel");
    const list = document.getElementById("matches-list");
    const subtitle = document.getElementById("matches-subtitle");

    if (!panel || !list || !subtitle) {
        showToast("Match results panel not found. Check index.html.");
        return;
    }

    panel.hidden = false;
    list.innerHTML = `
        <div class="matches-empty">
            <h3>Finding possible matches...</h3>
            <p>Please wait while we compare reports.</p>
        </div>
    `;
    subtitle.textContent = "Checking reports in the database";

    panel.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

    try {
        const response = await fetch(
            `${API_URL}/matches/${itemId}`
        );

        if (!response.ok) {
            throw new Error("Could not load matching reports.");
        }

        const data = await response.json();
        const matches = data.matches || [];

        const sourceItem = items.find(
            item => Number(item.id) === Number(itemId)
        );

        subtitle.textContent = sourceItem
            ? `Possible matches for ${sourceItem.name}`
            : "Reports that may match your item";

        if (matches.length === 0) {
            list.innerHTML = `
                <div class="matches-empty">
                    <h3>No possible matches yet</h3>
                    <p>
                        Try again when another person reports
                        an item with similar details.
                    </p>
                </div>
            `;
            return;
        }

        list.innerHTML = matches.map(match => {
            const score = Math.max(
                0,
                Math.min(100, Number(match.match_score) || 0)
            );

            const status = String(match.status || "").toUpperCase();
            const statusClass =
                status === "LOST" ? "lost" : "found";

            const matchingWords = Array.isArray(match.matching_words)
                ? match.matching_words
                : [];

            const wordTags = matchingWords.length
                ? matchingWords.map(word =>
                    `<span class="match-word">${escapeHTML(String(word))}</span>`
                ).join("")
                : `<span class="match-word">Details overlap</span>`;

            return `
                <article class="match-card">
                    <div class="match-card-top">
                        <div>
                            <h3 class="match-item-name">
                                ${escapeHTML(String(match.name || "Unnamed item"))}
                            </h3>
                            <span class="match-status ${statusClass}">
                                ${escapeHTML(status || "UNKNOWN")}
                            </span>
                        </div>

                        <div class="match-score">
                            <strong>${score}%</strong>
                            <span>Match score</span>
                        </div>
                    </div>

                    <div
                        class="match-progress"
                        role="progressbar"
                        aria-label="Match score"
                        aria-valuemin="0"
                        aria-valuemax="100"
                        aria-valuenow="${score}"
                    >
                        <div
                            class="match-progress-fill"
                            style="width: ${score}%"
                        ></div>
                    </div>

                    <p class="match-description">
                        ${escapeHTML(String(match.description || "No description provided."))}
                    </p>

                    <div class="match-meta">
                        <div class="match-meta-row">
                            <span>📦</span>
                            <span>Category: ${escapeHTML(String(match.category || "Not specified"))}</span>
                        </div>

                        <div class="match-meta-row">
                            <span>📍</span>
                            <span>Location: ${escapeHTML(String(match.location || "Not specified"))}</span>
                        </div>

                        <div class="match-meta-row">
                            <span>📅</span>
                            <span>Date: ${escapeHTML(String(match.date || "Not specified"))}</span>
                        </div>
                    </div>

                    <div class="match-words">
                        <div class="match-words-title">
                            Matching details
                        </div>
                        ${wordTags}
                    </div>
                </article>
            `;
        }).join("");

    } catch (error) {
        console.error("Smart matching error:", error);

        list.innerHTML = `
            <div class="matches-empty">
                <h3>Couldn't load matches</h3>
                <p>
                    Check that the CampusConnect backend is running,
                    then try again.
                </p>
            </div>
        `;

        showToast("Unable to load matches. Check the backend.");
    }
}

function closeMatchesPanel() {
    const panel = document.getElementById("matches-panel");

    if (panel) {
        panel.hidden = true;
    }
}


searchInput.addEventListener("input", renderItems);
categoryFilter.addEventListener("change", renderItems);
statusFilter.addEventListener("change", renderItems);


reportForm.addEventListener("submit", async event => {
    event.preventDefault();

    const submitButton = reportForm.querySelector(
        'button[type="submit"]'
    );

    if (submitButton) {
        submitButton.disabled = true;
    }

    try {
        const formData = new FormData(reportForm);

        const payload = {
            name: String(formData.get("name") || "").trim(),
            category: String(formData.get("category") || ""),
            location: String(formData.get("location") || "").trim(),
            date: String(formData.get("date") || ""),
            description: String(
                formData.get("description") || ""
            ).trim(),
            status: currentStatus.toUpperCase()
        };

        if (
            !payload.name ||
            !payload.category ||
            !payload.location ||
            !payload.date ||
            !payload.description
        ) {
            showToast("Please complete all required fields.");
            return;
        }

        const response = await fetch(`${API_URL}/items`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(
                errorData.detail || "Could not save the report."
            );
        }

        reportForm.reset();
        closeReportForm();

        await loadItems();

        showToast("Report saved successfully!");

        document.getElementById("items").scrollIntoView({
            behavior: "smooth"
        });

    } catch (error) {
        console.error("Report submission failed:", error);
        showToast(
            error.message || "Could not connect to the backend."
        );
    } finally {
        if (submitButton) {
            submitButton.disabled = false;
        }
    }
});
    

reportModal.addEventListener("click", event => {
    if (event.target === reportModal) {
        closeReportForm();
    }
});

document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        closeReportForm();
    }
});








loadItems();

