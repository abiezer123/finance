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
    "tithes", "offering", "fp", "hor", "sundayschool",
    "for_visitor", "others", "tithes(tithes)", "church tithes",
    "fp(tithes)", "hor(tithes)", "sundayschool(tithes)",
    "fp(hq)", "hor(hq)", "soc", "sfc", "ph", "amd", "crv"
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
        const option = document.createElement("option");
        option.value = category;
        option.textContent = category.charAt(0).toUpperCase() + category.slice(1);
        modalCategorySelect.appendChild(option);

    });
}


// Open modal (safe check if button exists)
if (addExpenseBtn) {
    addExpenseBtn.addEventListener("click", () => {

        modalCategorySelect.style.display = "block";
        modal.style.display = "block";
        modalCategoryName.textContent = currentCategory.charAt(0).toUpperCase() + currentCategory.slice(1);
        modalCategorySelect.value = currentCategory;
    });
}


// Close modal
closeModalBtn.addEventListener("click", () => {
    modal.style.display = "none";
});

function addExpense() {
    const category = modalCategorySelect.value;
    const amount = parseFloat(modalAmount.value);
    const label = modalLabel.value || "No label"; const date = modalDate.value || new Date().toISOString().split('T')[0];
    if (isNaN(amount)) {
        alert("Please enter a valid amount.");
        return;
    }

    database.entries.push({
        category,
        amount,
        label,
        date,
        reported: false,
    });
    saveDatabase();
    updateTable();
    modal.style.display = "none";
    modalAmount.value = "";
    modalLabel.value = "";
}

function editExpense(index, newAmount, newLabel, newCategory) {

    if (isNaN(newAmount)) { alert("Please enter a valid amount."); return; }

    const expense = database.entries[index];

    expense.amount = newAmount;
    expense.label = newLabel || expense.label;
    if (newCategory) {
        expense.category = newCategory;
    }

    fetch(`/category-summary/edit-expense/${expense._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            amount: newAmount,
            label: newLabel,
            category: newCategory  // ✅ Ensure this is included
        }),
    })
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                saveDatabase();   // optional: check if this overwrites data
                updateTable();
            } else {
                alert("Failed to update expense.");
            }
        })
        .catch(error => console.error("Error updating expense:", error));
}


function deleteExpense(index) { database.entries.splice(index, 1); saveDatabase(); updateTable(); }
function updateTable() {
    const table = document.getElementById('summary-table'); table.innerHTML = ''; // Clear the existing table
    database.entries.forEach((entry, index) => {
        const row = document.createElement('tr');
        const categoryCell = document.createElement('td');
        const dateCell = document.createElement('td');
        const amountCell = document.createElement('td');
        const labelCell = document.createElement('td');
        const actionCell = document.createElement('td');

        categoryCell.textContent = entry.category;
        dateCell.textContent = entry.date;
        amountCell.textContent = entry.amount;
        labelCell.textContent = entry.label;

        // Edit button
        const editButton = document.createElement('button');
        editButton.textContent = 'Edit';
        editButton.onclick = () => {
            const newAmount = parseFloat(prompt("Enter new amount:", entry.amount));
            const newLabel = prompt("Enter new label:", entry.label);
            if (newAmount !== null) {
                editExpense(index, newAmount, newLabel);
            }
        };

        // Delete button
        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.onclick = () => {
            if (confirm("Are you sure you want to delete this entry?")) {
                deleteExpense(index);
            }
        };

        actionCell.appendChild(editButton);
        actionCell.appendChild(deleteButton);
        row.appendChild(categoryCell);
        row.appendChild(dateCell);
        row.appendChild(amountCell);
        row.appendChild(labelCell);
        row.appendChild(actionCell);
        table.appendChild(row);
    });

    updateCashOnHand();

}


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
    const expenseId = document.getElementById("modal-expense-id").value;

    if (!label || isNaN(amount)) {
        alert("Please enter a valid label and amount.");
        return;
    }

    const today = new Date().toISOString().split("T")[0];

    if (modal.getAttribute("data-mode") === "edit" && expenseId) {
        // Edit mode
        const res = await fetch(`/category-summary/edit-expense/${expenseId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                amount,
                label,
                category: selectedCat
            }),
        });

        if (res.ok) {
            modal.style.display = "none";
            expenseForm.reset();
            fetchCategoryData(currentCategory);
        } else {
            alert("Failed to update expense.");
        }
    } else {
        // Add mode
        const res = await fetch("/api/manual-expense", {
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
            fetchCategoryData(currentCategory);
        } else {
            alert("Failed to add manual expense.");
        }
    }

    modal.removeAttribute("data-mode");
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
            "tithes(tithes)", "church tithes", "fp(tithes)", "hor(tithes)", "sundayschool(tithes)",
            "crv", "fp(hq)", "hor(hq)", "sfc", "ph"
        ].map(type => type.toLowerCase());

        const isDerivedInput = derivedInputTypes.includes(entry.type.toLowerCase());

        let amountClass = 'text-red';
        if (isTotalGiving || isDerivedInput) {
            amountClass = 'text-black';
        } else if (isTotalDeduction) {
            amountClass = 'text-black';
        } else if (isTotalExpenses) {
            amountClass = 'text-dark-red';
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
        const isDeletable = entry.source === "manual";

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${entry.date}</td>
            <td><strong>${entry.type}</strong></td>
            <td class="${amountClass}"><strong>${displayAmount}</strong></td>
            <td>${entry.label || "-"}</td>
            <td>${expenses}</td>
            <td>${remaining}</td>
            <td>
                ${isDeletable ? `
                    <button class="edit-btn" style="background-color: #2980b9; color: white; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer;" data-id="${getEntryId(entry)}" data-label="${entry.label}" data-amount="${entry.amount}">Edit</button>
                    <button class="delete-btn" style="background-color: #e74c3c; color: white; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer;" data-id="${getEntryId(entry)}">Delete</button>
                ` : "-"}
            </td>
        `;

        //Highlight Total Giving rows
        if (isTotalGiving) {
            tr.style.backgroundColor = "#d1ffd1";
        } else if (isTotalExpenses) {
            tr.style.backgroundColor = "#FFDAB9";
        } else if (isTotalDeduction) {
            tr.style.backgroundColor = "#ffd595ff";
        }



        if (isDeletable) {
            const deleteBtn = tr.querySelector(".delete-btn");
            const editBtn = tr.querySelector(".edit-btn");

            deleteBtn.addEventListener("click", async () => {
                const confirmDelete = confirm("Delete this manual expense?");
                if (!confirmDelete) return;

                const res = await fetch(`/category-summary/delete-expense/${getEntryId(entry)}`, {
                    method: "DELETE",
                });

                if (res.ok) {
                    fetchCategoryData(currentCategory);
                } else {
                    alert("Failed to delete manual expense.");
                }
            });

            editBtn.addEventListener("click", () => {
                modalCategorySelect.style.display = "none";
                modal.style.display = "block";
                document.getElementById("modal-category-name").textContent = currentCategory;
                document.getElementById("modal-category-select").value = currentCategory;
                document.getElementById("expense-label").value = entry.label || "";
                document.getElementById("expense-amount").value = entry.amount;
                document.getElementById("modal-expense-id").value = getEntryId(entry);
                modal.setAttribute("data-mode", "edit");
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

// Initial load
window.addEventListener("DOMContentLoaded", () => {
    const scrollBtn = document.getElementById("scroll-calculator-btn");
    const mainCalcBtn = document.getElementById("open-calculator");

    // Prevent errors if buttons are missing
    if (!scrollBtn || !mainCalcBtn) return;

    // Show/hide floating button when scrolling
    window.addEventListener("scroll", function () {
        if (window.scrollY > 50) {
            scrollBtn.style.display = "flex";
        } else {
            scrollBtn.style.display = "none";
        }
    });

    // Trigger calculator on floating button click
    scrollBtn.addEventListener("click", function () {
        mainCalcBtn.click();
    });

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
    window.addEventListener("click", function (e) {
        if (e.target === calcModal) calcModal.style.display = "none";
    });

    document.querySelectorAll(".calc-btn").forEach(btn => {
        btn.onclick = function () {
            const action = btn.getAttribute("data-action");
            if (!isNaN(action)) {
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
    tableForNames();
    ColumnTag();
});


function tableForNames() {
    const categorySelect = document.getElementById("category-select");
    const monthPicker = document.getElementById("month-picker");
    const givingsHeader = document.getElementById("givings-header");
    const givingsBody = document.getElementById("givings-body");

    // Deduction percentages (match your backend logic)
    const categoryDeductions = {
        "tithes": [
            { name: "Tithes - 10%", percent: 0.10 },
            { name: "Offering - 30%", percent: 0.30 },
            { name: "CRV - 10%", percent: 0.10 },
            { name: "Pastor - 50%", percent: 0.50 }
        ],
        "offering": [
            { name: "Church Tithes - 10%", percent: 0.10 },
            { name: "CRV - 10%", percent: 0.10 }
        ],
        "fp": [
            { name: "Tithes - 10%", percent: 0.10 },
            { name: "HQ - 45%", percent: 0.45 }
        ],
        "hor": [
            { name: "Tithes - 10%", percent: 0.10 },
            { name: "HQ - 45%", percent: 0.45 }
        ],
        "sundayschool": [
            { name: "Tithes - 10%", percent: 0.10 }
        ],
        // Other categories: no deductions
    };

    async function loadGivingsTable() {
        const category = categorySelect.value;
        const month = monthPicker.value;
        if (!category || !month) return;

        const res = await fetch(`/api/givings-per-person/${encodeURIComponent(category)}?month=${month}`);
        const data = await res.json();

        if (!data.dates || data.dates.length === 0) {
            givingsHeader.innerHTML = "<th>No data</th>";
            givingsBody.innerHTML = "";
            return;
        }

        // Get deduction rules for current category
        const deductions = categoryDeductions[category] || [];

        // Build header: number + name + each date + total + deductions
        givingsHeader.innerHTML = `<th>#</th><th>Name</th>` +
            data.dates.map(d => `<th>${new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</th>`).join("") +
            `<th>Total</th>` +
            deductions.map(ded => `<th>${ded.name}</th>`).join("");

        // Column totals
        let colTotals = Array(data.dates.length).fill(0);
        let grandTotal = 0;
        let deductionTotals = Array(deductions.length).fill(0);

        // Build rows
        givingsBody.innerHTML = data.data.map((row, idx) => {
            let rowTotal = 0;
            let cells = `<td>${idx + 1}</td><td>${row.name}</td>`;

            // Date columns
            data.dates.forEach((d, colIdx) => {
                let val = row[d] || 0;
                rowTotal += val;
                colTotals[colIdx] += val;
                cells += `<td>${val ? `₱${val.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : ""}</td>`;
            });

            grandTotal += rowTotal;

            // Total column (highlighted)
            cells += `<td style="background-color: #d1ffd1; font-weight: bold;">
                    ₱${rowTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </td>`;

            // Deduction columns (orange)
            deductions.forEach((ded, i) => {
                let dedAmount = rowTotal * ded.percent;
                deductionTotals[i] += dedAmount;
                cells += `<td style="background-color: #FFDAB9; color: black;">
                        ₱${dedAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </td>`;
            });

            return `<tr>${cells}</tr>`;
        }).join("");

        // Footer totals row
        let totalRow = `<tr style="font-weight: bold; background-color: #f0f0f0;">
        <th colspan="2">Total</th>`;
        colTotals.forEach(val => {
            totalRow += `<th>₱${val.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</th>`;
        });
        totalRow += `<th style="background-color: #d1ffd1;">₱${grandTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</th>`;
        deductionTotals.forEach(val => {
            totalRow += `<th style="background-color: #FFDAB9; color: black;">
                        ₱${val.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </th>`;
        });
        totalRow += `</tr>`;

        givingsBody.innerHTML += totalRow;
    }

    categorySelect.addEventListener("change", loadGivingsTable);
    monthPicker.addEventListener("change", loadGivingsTable);

    // Default to current month
    const now = new Date();
    monthPicker.value = now.toISOString().slice(0, 7);
    loadGivingsTable();
}



function ColumnTag() {
    const table = document.getElementById("givings-table");
    const headers = Array.from(table.querySelectorAll("thead th"));
    const infoBox = document.getElementById("info-box");

    table.addEventListener("click", function (e) {
        if (e.target.tagName.toLowerCase() === "td") {
            const td = e.target;
            const row = td.parentElement;
            const colIndex = Array.from(row.children).indexOf(td);

            // Column 0 = number, column 1 = name, column 2+ = dates
            const headerText = table.querySelector(`thead th:nth-child(${colIndex + 1})`)?.innerText || "Unknown Date";

            const name = row.children[1]?.innerText || "N/A"; // Name is column 1
            const amount = td.innerText ? `${td.innerText}` : "₱0";


            infoBox.innerHTML = `<strong>${headerText}</strong><br>- ${name}<br>- ${amount}`;
            infoBox.style.left = e.pageX + 10 + "px";
            infoBox.style.top = e.pageY + 10 + "px";
            infoBox.style.display = "block";

            clearTimeout(infoBox.timeout);
            infoBox.timeout = setTimeout(() => {
                infoBox.style.display = "none";
            }, 2500);
        }
    });

    document.addEventListener("click", function (e) {
        if (!e.target.closest("#givings-table")) {
            infoBox.style.display = "none";
        }
    });
}



document.getElementById("print-table-btn").addEventListener("click", async () => {
    const startMonth = prompt("Enter start month (YYYY-MM) e.g. 2025-08");
    if (!startMonth) return;
    const endMonth = prompt("Enter end month (YYYY-MM) e.g. 2025-10");
    if (!endMonth) return;

    function getMonths(start, end) {
        const startDate = new Date(start + "-01");
        const endDate = new Date(end + "-01");
        const months = [];
        let current = startDate;
        while (current <= endDate) {
            const m = current.getMonth() + 1;
            const monthStr = `${current.getFullYear()}-${m.toString().padStart(2, "0")}`;
            months.push(monthStr);
            current.setMonth(current.getMonth() + 1);
        }
        return months;
    }

    function formatDate(dateStr) {
        const d = new Date(dateStr);
        if (isNaN(d)) return dateStr;
        return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    }

    function formatMonth(dateStr) {
        const d = new Date(dateStr + "-01");
        if (isNaN(d)) return dateStr;
        return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    }

    function calculateDeductions(value, category) {
        if (!value || value === 0) return {};
        let deductions = {};
        switch (category.toLowerCase()) {
            case "tithes":
                deductions["Tithes 10%"] = value * 0.10;
                deductions["Offering 30%"] = value * 0.30;
                deductions["CRV 10%"] = value * 0.10;
                deductions["Pastor 50%"] = value - (deductions["Tithes 10%"] + deductions["Offering 30%"] + deductions["CRV 10%"]);
                break;
            case "offering":
                deductions["Church Tithes 10%"] = value * 0.10;
                deductions["CRV 10%"] = value * 0.10;
                deductions["Remaining"] = value - (deductions["Church Tithes 10%"] + deductions["CRV 10%"]);
                break;
            case "fp":
            case "hor":
                deductions["Tithes 10%"] = value * 0.10;
                deductions["HQ 45%"] = value * 0.45;
                deductions["Remaining"] = value - deductions["HQ 45%"];
                break;
            case "sundayschool":
                deductions["Tithes 10%"] = value * 0.10;
                deductions["Remaining"] = value - deductions["Tithes 10%"];
                break;
            default:
                deductions["Total"] = value;
        }
        return deductions;
    }

    const months = getMonths(startMonth, endMonth);
    const categorySelect = document.getElementById("category-select");
    const selectedCategory = categorySelect ? categorySelect.value : "";

    let htmlContent = `
        <html>
        <head>
            <title>Empire - ${selectedCategory.toUpperCase()}</title>
            <style>
                table { width: 100%; border-collapse: collapse; font-family: Arial; margin-bottom: 30px; }
                th, td { border: 1px solid #999; padding: 6px 10px; text-align: left; }
                th { background-color: #4A90E2; color: white; }
                tbody tr:nth-child(even) { background-color: #fafafa; }
                tfoot tr { font-weight: bold; background-color: #f0f0f0; }
                h2 { margin-bottom: 5px; }
            </style>
        </head>
        <body>
    `;

    for (const month of months) {
        try {
            const res = await fetch(`/api/givings-per-person/${selectedCategory}?month=${month}`);
            const data = await res.json();
            if (!data.dates || !data.data) continue;

            htmlContent += `<h2>Category: ${selectedCategory.toUpperCase()}</h2>`;
            htmlContent += `<h3>Month: ${formatMonth(month)}</h3>`;

            // Get dynamic deduction columns
            const sampleDeductions = calculateDeductions(1, selectedCategory);
            const deductionKeys = Object.keys(sampleDeductions);

            // Table headers
            htmlContent += `<table><thead><tr><th>Name</th>`;
            data.dates.forEach(d => htmlContent += `<th>${formatDate(d)}</th>`);
            htmlContent += `<th>Total</th>`;
            deductionKeys.forEach(k => htmlContent += `<th>${k}</th>`);
            htmlContent += `</tr></thead><tbody>`;

            // Totals accumulators
            const totalsPerDate = {};
            data.dates.forEach(d => totalsPerDate[d] = 0);
            let totalsRow = {};
            deductionKeys.forEach(k => totalsRow[k] = 0);
            let grandTotal = 0;

            // Populate table rows
            data.data.forEach(row => {
                let rowTotal = 0;
                let deductionsSum = {};
                deductionKeys.forEach(k => deductionsSum[k] = 0);

                htmlContent += `<tr><td>${row.name}</td>`;

                data.dates.forEach(date => {
                    const val = row[date] || 0;
                    rowTotal += val;
                    totalsPerDate[date] += val;

                    const deductions = calculateDeductions(val, selectedCategory);
                    deductionKeys.forEach(k => {
                        deductionsSum[k] += deductions[k] || 0;
                    });

                    htmlContent += `<td>${val !== 0 ? val.toFixed(2) : ""}</td>`;
                });

                htmlContent += `<td>${rowTotal !== 0 ? rowTotal.toFixed(2) : ""}</td>`;
                deductionKeys.forEach(k => {
                    totalsRow[k] += deductionsSum[k];
                    htmlContent += `<td>${deductionsSum[k] !== 0 ? deductionsSum[k].toFixed(2) : ""}</td>`;
                });

                htmlContent += `</tr>`;
                grandTotal += rowTotal;
            });

            // Totals row
            htmlContent += `<tfoot><tr><td>Total</td>`;
            data.dates.forEach(d => htmlContent += `<td>${totalsPerDate[d] !== 0 ? totalsPerDate[d].toFixed(2) : ""}</td>`);
            htmlContent += `<td>${grandTotal !== 0 ? grandTotal.toFixed(2) : ""}</td>`;
            deductionKeys.forEach(k => htmlContent += `<td>${totalsRow[k] !== 0 ? totalsRow[k].toFixed(2) : ""}</td>`);
            htmlContent += `</tr></tfoot>`;

            htmlContent += `</table>`;
        } catch (err) {
            console.error("Error fetching month data:", month, err);
        }
    }

    htmlContent += `</body></html>`;

    const printWindow = window.open('', '', 'width=900,height=700');
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 300);
});
