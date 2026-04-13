let allBooks = [];
let currentPage = 1;
const booksPerPage = 6;

function $(id) { return document.getElementById(id); }
function safeText(v) { return (v === null || v === undefined) ? "" : String(v); }

// --------------------
// Books: Add
// --------------------
async function addBook() {
  const bookTitle = $("bookTitle").value.trim();
  const publicationYear = $("publicationYear").value.trim();
  const authorName = $("authorName").value.trim();
  const imageUrl = $("imageUrl").value.trim();

  if (!bookTitle) return alert("Book title cannot be empty.");
  if (bookTitle.length > 100) return alert("Book title must be less than 100 characters.");

  const yearRegex = /^\d{4}$/;
  if (!yearRegex.test(publicationYear)) return alert("Publication year must be a valid 4-digit year (e.g., 2024).");

  if (!authorName) return alert("Author Name cannot be empty.");

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
    if (!res.ok) return alert(data.error || "Failed to add book");

    $("bookTitle").value = "";
    $("publicationYear").value = "";
    $("authorName").value = "";
    $("imageUrl").value = "";

    await showAllBooks();
  } catch (err) {
    console.error(err);
    alert("Network error adding book");
  }
}

// --------------------
// Books: Fetch & render
// --------------------
async function showAllBooks() {
  try {
    const res = await fetch("/api/books");
    const data = await res.json();

    if (!res.ok) return alert(data.error || "Error fetching books");

    allBooks = Array.isArray(data.books) ? data.books : [];
    currentPage = 1;
    renderPage();

    // make the button feel like it worked: scroll + highlight
    const section = $("bookshelfSection");
    if (section) {
      section.scrollIntoView({ behavior: "smooth", block: "start" });
      section.style.transition = "box-shadow 0.3s ease";
      section.style.boxShadow = "0 0 0 4px rgba(59,130,246,0.25)";
      setTimeout(() => section.style.boxShadow = "none", 800);
    }
  } catch (err) {
    console.error(err);
    alert("Network error fetching books");
  }
}

function renderPage() {
  const bookGrid = $("allbooks");
  bookGrid.innerHTML = "";

  const start = (currentPage - 1) * booksPerPage;
  const end = start + booksPerPage;
  const paginatedBooks = allBooks.slice(start, end);

  if (paginatedBooks.length === 0) {
    bookGrid.innerHTML = `<div style="padding:16px;">No books found.</div>`;
    updatePaginationButtons();
    return;
  }

  paginatedBooks.forEach(book => {
    const card = document.createElement("div");
    card.classList.add("book-card");

    const imgHtml = book.image_url
      ? `<img src="${book.image_url}" alt="Book cover" class="book-img" onerror="this.style.display='none';" />`
      : "";

    card.innerHTML = `
      ${imgHtml}
      <h3>${safeText(book.title)}</h3>
      <p><strong>${safeText(book.author_name) || "N/A"}</strong></p>
      <p>Published: ${safeText(book.publication_year)}</p>
    `;
    bookGrid.appendChild(card);
  });

  updatePaginationButtons();
}

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
  $("prevBtn").disabled = currentPage === 1;
  $("nextBtn").disabled = currentPage * booksPerPage >= allBooks.length;
}

// --------------------
// Search
// --------------------
async function runSearch(q) {
  const query = q.trim();
  if (!query) return showAllBooks();

  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();

    if (!res.ok) return alert(data.error || "Search failed");

    allBooks = Array.isArray(data.books) ? data.books : [];
    currentPage = 1;
    renderPage();
  } catch (err) {
    console.error(err);
    alert("Network error searching");
  }
}

// --------------------
// Reviews: Load + Add
// --------------------
async function loadReviews() {
  const list = $("reviewsList");
  list.innerHTML = "Loading reviews...";

  try {
    const res = await fetch("/api/reviews");
    const data = await res.json();

    if (!res.ok) {
      list.innerHTML = `<div style="color:red;">${data.error || "Failed to load reviews"}</div>`;
      return;
    }

    const reviews = Array.isArray(data.reviews) ? data.reviews : [];
    if (reviews.length === 0) {
      list.innerHTML = `<div>No reviews yet.</div>`;
      return;
    }

    list.innerHTML = reviews.map(r => `
      <div class="book-card" style="margin-bottom:10px;">
        <h3 style="margin:0 0 6px 0;">${r.book_title || "Unknown Book"}</h3>
        <p style="margin:0;"><strong>Reviewer:</strong> ${r.reviewer || "Anonymous"}
           <span style="margin-left:10px;"><strong>Rating:</strong> ${r.rating ?? "N/A"}</span>
        </p>
        <p style="margin-top:8px;">${r.review_text || ""}</p>
        <p style="font-size:12px; opacity:0.7;">${r.created_at || ""}</p>
      </div>
    `).join("");

  } catch (e) {
    console.error(e);
    list.innerHTML = `<div style="color:red;">Network error loading reviews</div>`;
  }
}

async function addReview() {
  const bookTitle = $("reviewBookTitle").value.trim();
  const reviewer = $("reviewerName").value.trim();
  const rating = parseInt($("reviewRating").value, 10);
  const reviewText = $("reviewText").value.trim();

  if (!bookTitle) return alert("Book Title is required.");
  if (!reviewer) return alert("Your Name is required.");
  if (!rating || rating < 1 || rating > 5) return alert("Rating must be 1–5.");
  if (!reviewText) return alert("Review text cannot be empty.");

  try {
    const res = await fetch("/api/reviews/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        book_title: bookTitle,
        reviewer: reviewer,
        rating: rating,
        review_text: reviewText
      })
    });

    const data = await res.json();
    if (!res.ok) return alert(data.error || "Failed to add review");

    $("reviewText").value = "";
    $("reviewRating").value = "";

    await loadReviews();
  } catch (e) {
    console.error(e);
    alert("Network error adding review");
  }
}

// --------------------
// Wire up events
// --------------------
window.addEventListener("DOMContentLoaded", () => {
  // button wiring
  $("showBooksButton").addEventListener("click", showAllBooks);
  $("prevBtn").addEventListener("click", previousPage);
  $("nextBtn").addEventListener("click", nextPage);

  // search typing
  $("searchBar").addEventListener("input", (e) => runSearch(e.target.value));

  // load on start
  showAllBooks();
  loadReviews();
});