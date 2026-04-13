// --------------------
// Global state
// --------------------
let allBooks = [];
let currentPage = 1;
const booksPerPage = 6;

// --------------------
// Helpers
// --------------------
function $(id) {
  return document.getElementById(id);
}

function safeText(v) {
  return (v === null || v === undefined) ? "" : String(v);
}

// --------------------
// Add Book
// --------------------
async function addBook() {
  const bookTitle = $("bookTitle").value.trim();
  const publicationYear = $("publicationYear").value.trim();
  const authorName = $("authorName").value.trim();
  const imageUrl = $("imageUrl").value.trim();

  if (!bookTitle) {
    alert("Book title cannot be empty.");
    return;
  }
  if (bookTitle.length > 100) {
    alert("Book title must be less than 100 characters.");
    return;
  }

  const yearRegex = /^\d{4}$/;
  if (!yearRegex.test(publicationYear)) {
    alert("Publication year must be a valid 4-digit year (e.g., 2024).");
    return;
  }

  if (!authorName) {
    alert("Author Name cannot be empty.");
    return;
  }

  try {
    const res = await fetch("/api/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: bookTitle,
        publication_year: publicationYear,
        author_name: authorName,
        image_url: imageUrl
      })
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Failed to add book");
      return;
    }

    // clear inputs
    $("bookTitle").value = "";
    $("publicationYear").value = "";
    $("authorName").value = "";
    $("imageUrl").value = "";

    // refresh list
    await showAllBooks();
  } catch (err) {
    console.error(err);
    alert("Network error while adding book");
  }
}

// --------------------
// Fetch All Books
// --------------------
async function showAllBooks() {
  try {
    const res = await fetch("/api/books");
    const data = await res.json();

    if (!res.ok) {
      console.error("API error:", data);
      alert(data.error || "Error fetching books");
      return;
    }

    allBooks = Array.isArray(data.books) ? data.books : [];
    currentPage = 1;
    renderPage();
  } catch (err) {
    console.error(err);
    alert("Network error while fetching books");
  }
}

// --------------------
// Render Current Page
// --------------------
function renderPage() {
  const bookGrid = $("allbooks");
  if (!bookGrid) return;

  bookGrid.innerHTML = "";

  const start = (currentPage - 1) * booksPerPage;
  const end = start + booksPerPage;
  const paginatedBooks = allBooks.slice(start, end);

  if (paginatedBooks.length === 0) {
    bookGrid.innerHTML = `<div style="padding:16px;">No books found.</div>`;
    updatePaginationButtons();
    return;
  }

  paginatedBooks.forEach((book) => {
    const card = document.createElement("div");
    card.classList.add("book-card");

    const imgHtml = book.image_url
      ? `<img src="${book.image_url}" alt="Book cover" class="book-img" onerror="this.style.display='none';" />`
      : "";

    card.innerHTML = `
      ${imgHtml}
      <h3>${safeText(book.title)}</h3>
      <p><strong>Author:</strong> ${safeText(book.author_name) || "N/A"}</p>
      <p><strong>Year:</strong> ${safeText(book.publication_year)}</p>
    `;

    bookGrid.appendChild(card);
  });

  updatePaginationButtons();
}

// --------------------
// Pagination Controls
// --------------------
function nextPage() {
  if (currentPage * booksPerPage < allBooks.length) {
    currentPage++;
    renderPage();
  }
}

function previousPage() {
  if (currentPage > 1) {
    currentPage--;
    renderPage();
  }
}

function updatePaginationButtons() {
  const prevBtn = $("prevBtn");
  const nextBtn = $("nextBtn");

  if (prevBtn) prevBtn.disabled = currentPage === 1;
  if (nextBtn) nextBtn.disabled = currentPage * booksPerPage >= allBooks.length;
}

// --------------------
// Search (optional: if your backend has /api/search?q= )
// --------------------
async function runSearch(q) {
  const query = q.trim();
  if (!query) {
    await showAllBooks();
    return;
  }

  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();

    if (!res.ok) {
      console.error("Search API error:", data);
      alert(data.error || "Search failed");
      return;
    }

    allBooks = Array.isArray(data.books) ? data.books : [];
    currentPage = 1;
    renderPage();
  } catch (err) {
    console.error(err);
    alert("Network error while searching");
  }
}

// --------------------
// Wire up events (fixes button not working)
// --------------------
window.addEventListener("DOMContentLoaded", () => {
  // Make button work even if inline onclick fails
  const showBtn = $("showBooksButton");
  if (showBtn) showBtn.addEventListener("click", showAllBooks);

  const prevBtn = $("prevBtn");
  if (prevBtn) prevBtn.addEventListener("click", previousPage);

  const nextBtn = $("nextBtn");
  if (nextBtn) nextBtn.addEventListener("click", nextPage);

  // Search bar typing
  const searchBar = $("searchBar");
  if (searchBar) {
    searchBar.addEventListener("input", (e) => runSearch(e.target.value));
  }

  // Auto-load books on page load
  showAllBooks();
});