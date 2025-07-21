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
const expenseDeletableCategories = [
    "offering", "fp", "hor", "soc", "sundayschool",
    "for_visitor", "others", "amd", "crv"
];


let currentCategory = "";

function getEntryId(entry) {
    if (typeof entry._id === "object" && entry._id.$oid) {
        return entry._id.$oid;
    }
    return entry._id;
}
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

// // Open modal
// addExpenseBtn.addEventListener("click", () => {
//     if (expenseRestrictedCategories.includes(currentCategory)) {
//         alert("This category does not support direct expense input.");
//         return;
//     }
//     modal.style.display = "block";
//     modalCategoryName.textContent = currentCategory.charAt(0).toUpperCase() + currentCategory.slice(1);
//     modalCategorySelect.value = currentCategory;
// });

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

    const res = await fetch("/api/manual-category-expense", {
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
        fetchCategoryData(currentCategory); // <-- ensure this refreshes the table!
    } else {
        alert("Failed to add manual expense.");
    }
    console.log("Submitting manual expense...");

});



// Fetch and render category data
async function fetchCategoryData(category) {
    const res = await fetch(`/api/category-history/${encodeURIComponent(category)}`);
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
        const isDeletable = expenseDeletableCategories.includes(currentCategory) && entry.label;

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${entry.date}</td>
            <td><strong>${entry.type}</strong></td>
            <td class="${amountClass}"><strong>${displayAmount}</strong></td>
            <td>${entry.label || "-"}</td>
            <td>${expenses}</td>
            <td>${remaining}</td>
            <td>
                ${isDeletable ? `<button class="delete-btn" data-id="${getEntryId(entry)}">🗑️</button>` : "-"}
            </td>
        `;
        if (isDeletable) {
            const deleteBtn = tr.querySelector(".delete-btn");
            deleteBtn.addEventListener("click", async () => {
                const confirmDelete = confirm("Delete this expense?");
                if (!confirmDelete) return;

                const res = await fetch(`/delete-expense/${getEntryId(entry)}`, {
                    method: "DELETE",
                });

                if (res.ok) {
                    fetchCategoryData(currentCategory);
                } else {
                    alert("Failed to delete expense.");
                }
            });
        }



        tableBody.appendChild(tr);


    });

    cashDisplay.textContent = `Cash on Hand: ₱${totalCash.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

// Handle dropdown change
categorySelect.addEventListener("change", () => {
    currentCategory = categorySelect.value;
    fetchCategoryData(currentCategory);
});

// function renderCategoryTable(data, selectedCategory) {
//     const tableBody = document.getElementById("category-table-body");
//     const cashOnHandDisplay = document.getElementById("cash-on-hand");

//     tableBody.innerHTML = ""; // Clear old rows
//     let cashOnHand = 0;

//     data.forEach(entry => {
//         const row = document.createElement("tr");

//         const dateCell = document.createElement("td");
//         dateCell.textContent = entry.date;
//         row.appendChild(dateCell);

//         const typeCell = document.createElement("td");
//         typeCell.textContent = entry.type;
//         row.appendChild(typeCell);

//         const amountCell = document.createElement("td");
//         amountCell.textContent = `₱${parseFloat(entry.amount || 0).toFixed(2)}`;
//         row.appendChild(amountCell);

//         const labelCell = document.createElement("td");
//         labelCell.textContent = entry.label || "";
//         row.appendChild(labelCell);

//         const totalExpensesCell = document.createElement("td");
//         totalExpensesCell.textContent = entry.total_expenses !== undefined
//             ? `₱${parseFloat(entry.total_expenses || 0).toFixed(2)}`
//             : "-";
//         row.appendChild(totalExpensesCell);

//         const remainingCell = document.createElement("td");
//         remainingCell.textContent = entry.remaining !== undefined
//             ? `₱${parseFloat(entry.remaining || 0).toFixed(2)}`
//             : "-";
//         row.appendChild(remainingCell);

//         // ACTION column (only show delete button for manual entries)
//         const actionCell = document.createElement("td");

//         if (entry.label === "Added manually" || entry.source === "manual") {
//             const deleteBtn = document.createElement("button");
//             deleteBtn.textContent = "Delete";
//             deleteBtn.classList.add("delete-btn");
//             deleteBtn.addEventListener("click", () => {
//                 deleteManualExpense(entry); // Implement this function separately
//             });
//             actionCell.appendChild(deleteBtn);
//         } else {
//             actionCell.textContent = "-";
//         }

//         row.appendChild(actionCell);

//         tableBody.appendChild(row);

//         if (entry.type === "Cash on Hand") {
//             cashOnHand = entry.amount || 0;
//         }
//     });

//     // Update Cash on Hand display
//     cashOnHandDisplay.textContent = `Cash on Hand: ₱${parseFloat(cashOnHand).toFixed(2)}`;
// }

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

    // Calculator modal logic
    const calcModal = document.getElementById("calculator-modal");
    const openCalcBtn = document.getElementById("open-calculator");
    const closeCalcBtn = document.getElementById("close-calculator-modal");
    const calcDisplay = document.getElementById("calc-display");
    const calcHistory = document.getElementById("calc-history");
    let calcValue = "0";
    let calcOperator = "";
    let calcOperand = null;
    let calcReset = false;

    function updateCalcDisplay() {
        calcDisplay.value = calcValue;
        if (calcOperator && calcOperand !== null) {
            calcHistory.textContent = `${calcOperand} ${calcOperator}`;
        } else {
            calcHistory.textContent = "";
        }
    }

    if (openCalcBtn && calcModal) {
        openCalcBtn.onclick = () => { calcModal.style.display = "flex"; };
    }
    if (closeCalcBtn && calcModal) {
        closeCalcBtn.onclick = () => { calcModal.style.display = "none"; };
    }
    window.addEventListener("click", function(e) {
        if (e.target === calcModal) calcModal.style.display = "none";
    });

    document.querySelectorAll(".calc-btn").forEach(btn => {
        btn.onclick = function() {
            const action = btn.getAttribute("data-action");
            if (!isNaN(action)) { // Number
                if (calcValue === "0" || calcReset) {
                    calcValue = action;
                    calcReset = false;
                } else {
                    calcValue += action;
                }
            } else if (action === ".") {
                if (!calcValue.includes(".")) calcValue += ".";
            } else if (["+", "-", "*", "/"].includes(action)) {
                if (calcOperator && calcOperand !== null && !calcReset) {
                    // Chain operations
                    let result = 0;
                    const curr = parseFloat(calcValue);
                    switch (calcOperator) {
                        case "+": result = calcOperand + curr; break;
                        case "-": result = calcOperand - curr; break;
                        case "*": result = calcOperand * curr; break;
                        case "/": result = curr === 0 ? "Error" : calcOperand / curr; break;
                    }
                    calcOperand = (result === "Error") ? 0 : result;
                    calcValue = (result === "Error") ? "Error" : calcOperand.toString();
                } else {
                    calcOperand = parseFloat(calcValue);
                }
                calcOperator = action;
                calcReset = true;
            } else if (action === "=") {
                if (calcOperator && calcOperand !== null) {
                    let result = 0;
                    const curr = parseFloat(calcValue);
                    switch (calcOperator) {
                        case "+": result = calcOperand + curr; break;
                        case "-": result = calcOperand - curr; break;
                        case "*": result = calcOperand * curr; break;
                        case "/": result = curr === 0 ? "Error" : calcOperand / curr; break;
                    }
                    calcHistory.textContent = `${calcOperand} ${calcOperator} ${curr} =`;
                    calcValue = (result === "Error") ? "Error" : result.toString();
                    calcOperator = "";
                    calcOperand = null;
                    calcReset = true;
                }
            } else if (action === "clear") {
                calcValue = "0";
                calcOperator = "";
                calcOperand = null;
                calcReset = false;
                calcHistory.textContent = "";
            } else if (action === "back") {
                if (calcValue.length > 1) {
                    calcValue = calcValue.slice(0, -1);
                } else {
                    calcValue = "0";
                }
            }
            updateCalcDisplay();
        };
    });
    updateCalcDisplay();
});

