let entries = {};
let editIndex = null;

const categories = [
    "tithes", "offering", "sfc", "fp", "ph", "hor",
    "soc", "sundayschool", "for_visitor", "others"
];


let tableBody;
let tfoot;
let modal; // modal element
let expenseForm;

document.addEventListener("DOMContentLoaded", () => {
    const dateInput = document.getElementById("entry-date");
    const selectedDateDisplay = document.getElementById("selected-date");
    const formDateInput = document.getElementById("form-date");
    modal = document.getElementById("expenses-modal");
    expenseForm = document.getElementById("expense-form");
    tableBody = document.querySelector("#entries-table tbody");
    tfoot = document.querySelector("#entries-table tfoot");

    const urlParams = new URLSearchParams(window.location.search);
    const selectedDate = urlParams.get("date") || new Date().toISOString().split("T")[0];

    dateInput.value = selectedDate;
    selectedDateDisplay.textContent = formatDatePretty(selectedDate);
    if (formDateInput) formDateInput.value = selectedDate;

    dateInput.addEventListener("change", () => {
        const selectedDate = dateInput.value;
        selectedDateDisplay.textContent = formatDatePretty(selectedDate);
        if (formDateInput) formDateInput.value = selectedDate;
        history.replaceState(null, "", `/?date=${selectedDate}`);
        fetchAndUpdateTable(selectedDate);
        loadSummaryWithExpenses();
    });

    fetchAndUpdateTable(selectedDate);
    loadSummaryWithExpenses();
    updateCashOnHand();

    // JPG Download
    document.getElementById("download-jpg").addEventListener("click", async () => {
        const tableWrapper = document.querySelector(".table-wrapper");
        if (!tableWrapper) return;
        tableWrapper.scrollLeft = 0;
        tableWrapper.style.overflow = "visible";

        const canvas = await html2canvas(tableWrapper, {
            scrollX: 0,
            scrollY: -window.scrollY,
            windowWidth: document.body.scrollWidth,
            useCORS: true
        });

        const link = document.createElement("a");
        const date = dateInput.value;
        link.download = `Report_${date || 'today'}.jpg`;
        link.href = canvas.toDataURL("image/jpeg");
        link.click();
    });
    document.getElementById("close-summary-modal").addEventListener("click", () => {
        document.getElementById("summary-modal").style.display = "none";
    });


    // Modal open/close
    document.getElementById("expenses-button").addEventListener("click", () => {
        modal.style.display = "block";
    });

    document.getElementById("close-expenses-modal").addEventListener("click", () => {
        modal.style.display = "none";
    });

    window.onclick = e => {
        if (e.target === modal) modal.style.display = "none";
    };

    // Handle expense form submit
    expenseForm.addEventListener("submit", async function (e) {
        e.preventDefault();
        const formData = new FormData(expenseForm);
        const expense = Object.fromEntries(formData.entries());
        expense.amount = parseFloat(expense.amount);
        expense.date = document.getElementById("entry-date").value;

        try {
            const res = await fetch("/add-expense", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(expense)
            });

            if (res.ok) {
                modal.style.display = "none";
                expenseForm.reset();
                fetchAndUpdateTable(expense.date);
                loadSummaryWithExpenses();
                updateCashOnHand();
            }
            else {
                alert("Failed to add expense.");
            }
        } catch (err) {
            console.error("Expense add error:", err);
        }
    });
});

// Fetch and update table
async function fetchAndUpdateTable(date) {
    try {
        const res = await fetch(`/api/entries?date=${date}`);
        const data = await res.json();
        entries[date] = data;
        updateTable(data);
    } catch (err) {
        console.error("Error fetching entries:", err);
    }
}

// Update the table
function updateTable(data) {
    if (!tableBody || !tfoot) return;

    tableBody.innerHTML = "";

    const totals = {
        tithes: 0, offering: 0, sfc: 0, fp: 0,
        ph: 0, hor: 0, soc: 0, others: 0,
        sundayschool: 0, for_visitor: 0
    };


    data.forEach((row, index) => {
        totals.tithes += row.tithes || 0;
        totals.offering += row.offering || 0;
        totals.sfc += row.sfc || 0;
        totals.fp += row.fp || 0;
        totals.ph += row.ph || 0;
        totals.hor += row.hor || 0;
        totals.soc += row.soc || 0;
        totals.others += row.others || 0;

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${row.name}</td>
            <td>${row.tithes || ""}</td>
            <td>${row.offering || ""}</td>
            <td>${row.sfc || ""}</td>
            <td>${row.fp || ""}</td>
            <td>${row.ph || ""}</td>
            <td>${row.hor || ""}</td>
            <td>${row.soc || ""}</td>
            <td>${row.sundayschool || ""}</td>
            <td>${row.for_visitor || ""}</td>
            <td>${row.others ? row.others + ` (${row.others_label || "N/A"})` : ""}</td>
            <td><button onclick="confirmDelete(${index})" style="background-color: #e74c3c; color: white; border: none; padding: 5px 10px; cursor: pointer;">Delete</button></td>
        `;
        tableBody.appendChild(tr);
    });

    // Totals row
    tfoot.innerHTML = `
        <tr>
            <td colspan="2"><strong>Totals:</strong></td>
            <td>${totals.tithes}</td>
            <td>${totals.offering}</td>
            <td>${totals.sfc}</td>
            <td>${totals.fp}</td>
            <td>${totals.ph}</td>
            <td>${totals.hor}</td>
            <td>${totals.soc}</td>
            <td>${totals.sundayschool}</td>
            <td>${totals.for_visitor}</td>
            <td>${totals.others}</td>
            <td></td>
        </tr>
    `;

    const totalIncome = Object.values(totals).reduce((sum, val) => sum + val, 0);
    document.getElementById("overall-income-total").textContent = `Overall: ₱${totalIncome.toLocaleString()}`;
}

// Delete logic
function confirmDelete(index) {
    const selectedDate = document.getElementById("entry-date").value;
    const entry = entries[selectedDate][index];
    if (!entry || !entry._id) return;

    const confirmed = confirm(`Delete entry: ${entry.name}?`);
    if (!confirmed) return;

    fetch(`/delete/${entry._id}`)
        .then(() => {
            fetchAndUpdateTable(selectedDate);
            loadSummaryWithExpenses();
            updateCashOnHand(); // ✅ Add this
        })
        .catch(err => console.error("Delete error:", err));
}

function formatDatePretty(dateString) {
    const date = new Date(dateString);
    const options = { year: "numeric", month: "long", day: "numeric" };
    return date.toLocaleDateString("en-US", options);
}

// Load summary and expenses table
async function loadSummaryWithExpenses() {
    const date = document.getElementById("entry-date").value;
    const [entriesRes, expensesRes] = await Promise.all([
        fetch(`/api/entries?date=${date}`),
        fetch(`/api/expenses?date=${date}`)
    ]);
    const entries = await entriesRes.json();
    const expenses = await expensesRes.json();

    const summaryBody = document.getElementById("summary-body");
    summaryBody.innerHTML = "";

    const originalTotals = {};
    const expenseTotals = {};
    categories.forEach(cat => {
        originalTotals[cat] = entries.reduce((sum, e) => sum + (parseFloat(e[cat]) || 0), 0);
        expenseTotals[cat] = 0;
    });

    // Original total row
    let totalRow = `<tr><td>-</td><td><b>Original Total</b></td>`;
    categories.forEach(cat => {
        totalRow += `<td><b>${originalTotals[cat]}</b></td>`;
    });
    totalRow += `<td>-</td></tr>`;
    summaryBody.innerHTML += totalRow;

    // Expense rows
    expenses.forEach((e, i) => {
        if (expenseTotals[e.from] !== undefined) {
            expenseTotals[e.from] += parseFloat(e.amount) || 0;
        }

        let row = `<tr><td>${i + 1}</td><td>Expense</td>`;
        categories.forEach(cat => {
            if (cat === e.from) {
                row += `<td>${parseFloat(e.amount).toFixed(2)} (${e.label})</td>`;
            } else {
                row += `<td></td>`;
            }
        });
        const deleteBtn = `<button onclick="deleteExpense('${e._id}')" style="background-color: #e74c3c; color: white; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer;">Delete</button>`;
        row += `<td>${deleteBtn}</td></tr>`;
        summaryBody.innerHTML += row;
    });

    // Total Expenses row
    let expenseTotalRow = `<tr><td>-</td><td><b>Total Expenses</b></td>`;
    categories.forEach(cat => {
        expenseTotalRow += `<td><b>${expenseTotals[cat]}</b></td>`;
    });
    expenseTotalRow += `<td>-</td></tr>`;
    summaryBody.innerHTML += expenseTotalRow;

    // Final cash on hand row
    let finalRow = `<tr><td>-</td><td><b>Cash on Hand</b></td>`;
    categories.forEach(cat => {
        finalRow += `<td><b>${originalTotals[cat] - expenseTotals[cat]}</b></td>`;
    });
    finalRow += `<td>-</td></tr>`;
    summaryBody.innerHTML += finalRow;

    const totalIncome = Object.values(originalTotals).reduce((sum, val) => sum + val, 0);
    const totalFinal = categories.reduce((acc, cat) => acc + (originalTotals[cat] - expenseTotals[cat]), 0);

    document.getElementById("overall-income-total").textContent = `Total Givings: ₱${totalIncome.toLocaleString()}`;
    document.getElementById("overall-final-total").textContent = `Total After Expenses: ₱${totalFinal.toLocaleString()}`;
}


// Delete expense
function deleteExpense(id) {
    const confirmed = confirm("Are you sure you want to delete this expense?");
    if (!confirmed) return;

    fetch(`/delete-expense/${id}`, {
        method: "DELETE"
    })
        .then(res => {
            if (res.ok) {
                loadSummaryWithExpenses();
                updateCashOnHand();
            } else {
                alert("Failed to delete expense.");
            }
        })
        .catch(err => {
            console.error("Error deleting expense:", err);
        });
}

async function loadAllTimeCashSummary() {
    const modal = document.getElementById("summary-modal");
    const tbody = document.getElementById("summary-details-body");
    const cashDisplay = document.getElementById("alltime-cash");

    modal.style.display = "block";
    tbody.innerHTML = "";
    let totalGivings = 0;
    let totalExpenses = 0;
    let totalCash = 0;

    try {
        const res = await fetch("/api/alltime-summary");
        const data = await res.json();

        // Sort from newest to oldest
        data.sort((a, b) => new Date(b.date) - new Date(a.date));

        data.forEach((record, index) => {
            const datePretty = formatDatePretty(record.date);
            const givings = record.givings || {};
            const expenses = record.expenses || [];
            const totalGiving = record.total_givings || 0;
            const totalExpense = record.total_expenses || 0;
            const cashOnHand = totalGiving - totalExpense;

            totalGivings += totalGiving;
            totalExpenses += totalExpense;
            totalCash += cashOnHand;

            let html = `<tr><td colspan="4"><b>Date: ${datePretty}</b></td></tr>`;

            // List of Expenses
            html += `<tr><td colspan="4"><u>Expenses:</u></td></tr>`;
            if (expenses.length === 0) {
                html += `<tr><td colspan="4"><i>No expenses recorded</i></td></tr>`;
            } else {
                expenses.forEach(exp => {
                    html += `
                        <tr>
                            <td></td>
                            <td>${exp.label}</td>
                            <td>${exp.from}</td>
                            <td>₱${parseFloat(exp.amount).toLocaleString()}</td>
                        </tr>`;
                });
            }

            // Givings
            html += `<tr><td colspan="4"><u>Givings:</u></td></tr>`;
            Object.entries(givings).forEach(([key, value]) => {
                html += `<tr>
                    <td></td>
                    <td colspan="2">${key}</td>
                    <td>₱${parseFloat(value).toLocaleString()}</td>
                </tr>`;
            });

            // Totals for the day
            html += `
                <tr style="background:#f6f6f6;">
                    <td colspan="3"><b>Total Givings</b></td>
                    <td><b>₱${totalGiving.toLocaleString()}</b></td>
                </tr>
                <tr style="background:#f6f6f6;">
                    <td colspan="3"><b>Total Expenses</b></td>
                    <td><b>₱${totalExpense.toLocaleString()}</b></td>
                </tr>
                <tr style="background:#e8f8f5;">
                    <td colspan="3"><b>Cash on Hand</b></td>
                    <td><b>₱${cashOnHand.toLocaleString()}</b></td>
                </tr>
                <tr><td colspan="4"><hr></td></tr>
            `;

            tbody.innerHTML += html;
        });

        // Final total
        cashDisplay.textContent = `Cash on Hand: ₱${totalCash.toLocaleString()}`;

    } catch (err) {
        console.error("Summary fetch error:", err);
        tbody.innerHTML = `<tr><td colspan="4">Error loading summary.</td></tr>`;
    }
}

function updateCashOnHand() {
    fetch("/api/alltime-summary")
        .then(res => res.json())
        .then(data => {
            let totalGivings = 0;
            let totalExpenses = 0;
            data.forEach(day => {
                totalGivings += day.total_givings;
                totalExpenses += day.total_expenses;
            });
            const cash = totalGivings - totalExpenses;
            document.getElementById("alltime-cash").innerText = `Cash on Hand: ₱${cash.toFixed(2)}`;
        });
}
