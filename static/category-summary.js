const categorySelect = document.getElementById("category-select");
const tableBody = document.getElementById("category-table-body");
const categoryTitle = document.getElementById("category-title");
const cashDisplay = document.getElementById("cash-on-hand");

const modal = document.getElementById("expense-modal");
const modalCategoryName = document.getElementById("modal-category-name");
const modalCategorySelect = document.getElementById("modal-category-select");
const expenseForm = document.getElementById("expense-form");
const closeModalBtn = document.getElementById("close-expense-modal");
const addExpenseBtn = document.getElementById("add-expense-btn");

const expenseRestrictedCategories = ["tithes", "sfc", "ph", "amd"];
const allCategories = [
    "tithes", "offering", "fp", "hor", "soc", "sundayschool",
    "for_visitor", "others", "tithes(tithes)", "offering(tithes)",
    "fp(tithes)", "hor(tithes)", "sundayschool(tithes)", "crv",
    "fp(hq)", "hor(hq)", "sfc", "ph", "amd"
];

let currentCategory = "";

// Populate category dropdown in modal
function populateExpenseDropdown() {
    modalCategorySelect.innerHTML = "";
    allCategories.forEach(category => {
        if (!expenseRestrictedCategories.includes(category)) {
            const option = document.createElement("option");
            option.value = category;
            option.textContent = category.charAt(0).toUpperCase() + category.slice(1);
            modalCategorySelect.appendChild(option);
        }
    });
}

// Open modal
addExpenseBtn.addEventListener("click", () => {
    if (expenseRestrictedCategories.includes(currentCategory)) {
        alert("This category does not support direct expense input.");
        return;
    }
    modal.style.display = "block";
    modalCategoryName.textContent = currentCategory.charAt(0).toUpperCase() + currentCategory.slice(1);
    modalCategorySelect.value = currentCategory;
});

// Close modal
closeModalBtn.addEventListener("click", () => {
    modal.style.display = "none";
});

window.addEventListener("click", (event) => {
    if (event.target === modal) {
        modal.style.display = "none";
    }
});

// Submit expense
expenseForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const label = document.getElementById("expense-label").value;
    const amount = parseFloat(document.getElementById("expense-amount").value);
    const selectedCat = modalCategorySelect.value;

    if (!label || isNaN(amount)) {
        alert("Please enter a valid label and amount.");
        return;
    }

    const today = new Date().toISOString().split("T")[0];

    const res = await fetch("/add-expense", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            date: today,
            from: selectedCat,
            label,
            amount,
        }),
    });

    if (res.ok) {
        modal.style.display = "none";
        expenseForm.reset();
        fetchCategoryData(currentCategory); // Refresh table
    } else {
        alert("Failed to add expense.");
    }
});

// Fetch and render category data
async function fetchCategoryData(category) {
    const res = await fetch(`/api/category-history/${category}`);
    const data = await res.json();

    data.sort((a, b) => {
        if (a.date === "-" || b.date === "-") return 0;
        return new Date(b.date) - new Date(a.date);
    });

    tableBody.innerHTML = "";
    categoryTitle.textContent = category.charAt(0).toUpperCase() + category.slice(1);
    let totalCash = 0;

    data.forEach(entry => {
        const type = entry.type.toLowerCase();
        const isCashRow = entry.type === "Cash on Hand";
        const isTotalGiving = type.includes("total giving");
        const isTotalExpenses = type.includes("total expenses");
        const isTotalDeduction = type.includes("total deduction");

        const derivedInputTypes = [
            "tithes(tithes)", "offering(tithes)", "fp(tithes)", "hor(tithes)", "sundayschool(tithes)",
            "crv", "fp(hq)", "hor(hq)", "sfc", "ph"
        ];
        const isDerivedInput = derivedInputTypes.includes(entry.type.toLowerCase());

        let amountClass = 'text-red';
        if (isTotalGiving || isDerivedInput) {
            amountClass = 'text-green';
        } else if (isTotalExpenses || isTotalDeduction) {
            amountClass = 'text-orange';
        }

        let amountValue = parseFloat(entry.amount).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });

        const displayAmount = (amountClass === 'text-green') ? `₱${amountValue}` : `-₱${amountValue}`;

        if (isCashRow) {
            totalCash = parseFloat(entry.amount);
            return;
        }

        const expenses = entry.total_expenses !== undefined ? `₱${parseFloat(entry.total_expenses).toFixed(2)}` : "-";
        const remaining = entry.remaining !== undefined ? `₱${parseFloat(entry.remaining).toFixed(2)}` : "-";

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${entry.date}</td>
            <td><strong>${entry.type}</strong></td>
            <td class="${amountClass}"><strong>${displayAmount}</strong></td>
            <td>${entry.label || "-"}</td>
            <td>${expenses}</td>
            <td>${remaining}</td>
            <td>
            ${entry.source === "manual"
                ? `<button class="delete-btn" data-id="${entry._id}">🗑️</button>`
                : ""}
            </td>

        `;
        tableBody.appendChild(tr);
        if (entry.source === "manual") {
            tr.querySelector(".delete-btn").addEventListener("click", async () => {
                const confirmDelete = confirm("Delete this expense?");
                if (!confirmDelete) return;

                const res = await fetch(`/delete-expense/${entry._id}`, {
                    method: "DELETE",
                });

                if (res.ok) {
                    fetchCategoryData(currentCategory); // Refresh table
                } else {
                    alert("Failed to delete expense.");
                }
            });
        }


    });

    cashDisplay.textContent = `Cash on Hand: ₱${totalCash.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

// Handle dropdown change
categorySelect.addEventListener("change", () => {
    currentCategory = categorySelect.value;
    fetchCategoryData(currentCategory);
});

// Initial load
window.addEventListener("DOMContentLoaded", () => {
    currentCategory = categorySelect.value;
    fetchCategoryData(currentCategory);
    populateExpenseDropdown();

    const navToggle = document.getElementById("nav-toggle");
    const navLinks = document.querySelector(".navbar-links");

    navToggle.addEventListener("change", () => {
        navLinks.style.display = navToggle.checked ? "flex" : "none";
    });

    navLinks.querySelectorAll("a").forEach(link => {
        link.addEventListener("click", () => {
            navToggle.checked = false;
            navLinks.style.display = "none";
        });
    });
});
