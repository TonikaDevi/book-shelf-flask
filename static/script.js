let allBooks = [];
let currentPage = 1;
const booksPerPage = 6;

// --------------------
// On load
// --------------------
window.addEventListener("DOMContentLoaded", () => {
  // Load books and reviews on startup
  showAllBooks();
  loadReviews();

  const sb = document.getElementById("searchBar");
  if (sb) {
    sb.addEventListener("input", () => {
      searchBooks(sb.value.trim());
    });
  }
});

// --------------------
// Add Book (SQLite)
// --------------------
function addBook() {
  const bookTitle = document.getElementById("bookTitle").value.trim();
  const publicationYear = document.getElementById("publicationYear").value.trim();
  const authorName = document.getElementById("authorName").value.trim();
  const imageUrl = document.getElementById("imageUrl").value.trim();

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

  // Validate URL only if provided
  if (imageUrl.length > 0) {
    try {
      new URL(imageUrl);
    } catch {
      alert("Please enter a valid Image URL (must start with http/https).");
      return;
    }
  }

  fetch("/api/add", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: bookTitle,
      publication_year: publicationYear,
      author_name: authorName,
      image_url: imageUrl
    }),
  })
    .then((r) => r.json())
    .then((data) => {
      if (data.error) {
        alert("Error: " + data.error);
        return;
      }
      document.getElementById("bookTitle").value = "";
      document.getElementById("publicationYear").value = "";
      document.getElementById("authorName").value = "";
      document.getElementById("imageUrl").value = "";
      showAllBooks();
    })
    .catch((err) => {
      console.error(err);
      alert("Add book failed. Check console.");
    });
}

// --------------------
// Books: Show All + Search + Render + Pagination
// --------------------
function showAllBooks() {
  fetch("/api/books")
    .then((r) => r.json())
    .then((data) => {
      allBooks = data.books || [];
      currentPage = 1;
      renderPage();
    })
    .catch((err) => console.error(err));
}

function searchBooks(query) {
  if (query.length === 0) {
    showAllBooks();
    return;
  }

  fetch(`/api/search?q=${encodeURIComponent(query)}`)
    .then((r) => r.json())
    .then((data) => {
      allBooks = data.books || [];
      currentPage = 1;
      renderPage();
    })
    .catch((err) => console.error(err));
}

function renderPage() {
  const bookGrid = document.getElementById("allbooks");
  bookGrid.innerHTML = "";

  const start = (currentPage - 1) * booksPerPage;
  const end = start + booksPerPage;
  const paginatedBooks = allBooks.slice(start, end);

  if (paginatedBooks.length === 0) {
    bookGrid.innerHTML = `<div class="text-muted p-3">No books found.</div>`;
    updatePaginationButtons();
    return;
  }

  paginatedBooks.forEach((book) => {
    const bookElement = document.createElement("div");
    bookElement.classList.add("book-card");

    bookElement.innerHTML = `
      ${book.image_url ? `<img src="${book.image_url}" alt="Book cover" class="book-img">` : ""}
      <p class="book-title">${book.title}</p>
      <p class="book-author">${book.author_name || "N/A"}</p>
      <p class="book-year">Published: ${book.publication_year}</p>
    `;

    bookGrid.appendChild(bookElement);
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
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");

  prevBtn.disabled = currentPage === 1;
  nextBtn.disabled = currentPage * booksPerPage >= allBooks.length;
}

// --------------------
// Reviews (MongoDB): Load + Add
// --------------------
function loadReviews() {
  fetch("/api/reviews")
    .then((r) => r.json())
    .then((data) => {
      const list = document.getElementById("reviewsList");
      list.innerHTML = "";

      const reviews = data.reviews || [];
      if (reviews.length === 0) {
        list.innerHTML = `<div class="text-muted">No reviews yet.</div>`;
        return;
      }

      reviews.forEach((rv) => {
        const ratingText =
          rv.rating !== undefined && rv.rating !== null && rv.rating !== ""
            ? `⭐ ${rv.rating}`
            : "";

        const item = document.createElement("div");
        item.className = "review-card";
        item.innerHTML = `
          <div class="review-header">
            <strong>${rv.book_title || "Untitled Book"}</strong>
            <span class="text-muted">${ratingText}</span>
          </div>
          <div class="text-muted small">By: ${rv.reviewer || "Unknown"}</div>
          <div class="mt-1">${rv.review_text || ""}</div>
        `;
        list.appendChild(item);
      });
    })
    .catch((err) => console.error("Load reviews error:", err));
}

function addReview() {
  const bookTitle = document.getElementById("reviewBookTitle").value.trim();
  const reviewer = document.getElementById("reviewerName").value.trim();
  const rating = document.getElementById("reviewRating").value.trim();
  const reviewText = document.getElementById("reviewText").value.trim();

  if (!bookTitle || !reviewer || !reviewText) {
    alert("Book Title, Reviewer, and Review Text are required.");
    return;
  }

  fetch("/api/reviews/add", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      book_title: bookTitle,
      reviewer: reviewer,
      rating: rating ? Number(rating) : null,
      review_text: reviewText,
    }),
  })
    .then((r) => r.json())
    .then((data) => {
      if (data.error) {
        alert("Error: " + data.error);
        return;
      }

      document.getElementById("reviewBookTitle").value = "";
      document.getElementById("reviewerName").value = "";
      document.getElementById("reviewRating").value = "";
      document.getElementById("reviewText").value = "";

      loadReviews();
    })
    .catch((err) => console.error("Add review error:", err));
}