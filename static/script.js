let entries = {};
let editIndex = null;
let tableBody;
let tfoot;
let modal;
let expenseForm;

document.addEventListener("DOMContentLoaded", () => {
    const dateInput = document.getElementById("entry-date");
    const selectedDateDisplay = document.getElementById("selected-date");
    const formDateInput = document.getElementById("form-date");
    modal = document.getElementById("expenses-modal");
    expenseForm = document.getElementById("expense-form");
    tableBody = document.querySelector("#entries-table tbody");
    tfoot = document.querySelector("#entries-table tfoot");
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll(".navbar-links li a");

    navLinks.forEach(link => {
        if (link.getAttribute("href") === currentPath) {
            link.classList.add("active");
        } else {
            link.classList.remove("active");
        }
    });

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
            if (editingExpenseId) {
                // Edit
                const res = await fetch(`/edit-expense/${editingExpenseId}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body: new URLSearchParams(expense)
                });
                if (!res.ok) throw new Error("Failed to edit expense");
            } else {
                // Add
                const res = await fetch("/add-expense", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(expense)
                });
                if (!res.ok) throw new Error("Failed to add expense");
            }
            modal.style.display = "none";
            expenseForm.reset();
            loadSummaryWithExpenses();
            updateCashOnHand();
        } catch (err) {
            alert(err.message);
            console.error("Expense submit error:", err);
        }
        editingExpenseId = null;
        document.querySelector("#expenses-modal h3").textContent = "Add Expense";
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

// for Entries Table
function updateTable(data) {
    if (!tableBody || !tfoot) return;

    tableBody.innerHTML = "";

    const totals = {
        tithes: 0, offering: 0, sfc: 0, fp: 0,
        ph: 0, hor: 0, soc: 0, others: 0,
        sundayschool: 0, for_visitor: 0, amd: 0
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
        totals.sundayschool += row.sundayschool || 0;
        totals.for_visitor += row.for_visitor || 0;
        totals.amd += row.amd || 0;

        const tr = document.createElement("tr");
        
        const total =
            parseFloat(row.tithes || 0) +
            parseFloat(row.offering || 0) +
            parseFloat(row.sfc || 0) +
            parseFloat(row.fp || 0) +
            parseFloat(row.ph || 0) +
            parseFloat(row.hor || 0) +
            parseFloat(row.soc || 0) +
            parseFloat(row.sundayschool || 0) +
            parseFloat(row.for_visitor || 0) +
            parseFloat(row.amd || 0) +
            parseFloat(row.others || 0);

        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${row.name}</td>
            <td>${row.tithes ? `₱${parseFloat(row.tithes).toFixed(2)}` : ""}</td>
            <td>${row.offering ? `₱${parseFloat(row.offering).toFixed(2)}` : ""}</td>
            <td>${row.sfc ? `₱${parseFloat(row.sfc).toFixed(2)}` : ""}</td>
            <td>${row.fp ? `₱${parseFloat(row.fp).toFixed(2)}` : ""}</td>
            <td>${row.ph ? `₱${parseFloat(row.ph).toFixed(2)}` : ""}</td>
            <td>${row.hor ? `₱${parseFloat(row.hor).toFixed(2)}` : ""}</td>
            <td>${row.soc ? `₱${parseFloat(row.soc).toFixed(2)}` : ""}</td>
            <td>${row.sundayschool ? `₱${parseFloat(row.sundayschool).toFixed(2)}` : ""}</td>
            <td>${row.for_visitor ? `₱${parseFloat(row.for_visitor).toFixed(2)}` : ""}</td>
            <td>${row.amd ? `₱${parseFloat(row.amd).toFixed(2)}` : ""}</td>
            <td>${row.others ? `₱${parseFloat(row.others).toFixed(2)} (${row.others_label || "N/A"})` : ""}</td>
            <td><strong>${total ? `₱${total.toFixed(2)}` : ""}<strong></td>
            <td style="display:flex; gap:10px; justify-content:center;">
                <button onclick="editEntry('${row._id}')" style="background-color: #3498db; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; flex:1;">Edit</button>    
                <button onclick="confirmDelete(${index})" style="background-color: #e74c3c; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; flex:1;">Delete</button>
            </td>
        `;
        tableBody.appendChild(tr);
    });

    // Totals row
    tfoot.innerHTML = `
        <tr>
            <td colspan="2"><strong>Totals:</strong></td>
            <td>₱${totals.tithes.toFixed(2)}</td>
            <td>₱${totals.offering.toFixed(2)}</td>
            <td>₱${totals.sfc.toFixed(2)}</td>
            <td>₱${totals.fp.toFixed(2)}</td>
            <td>₱${totals.ph.toFixed(2)}</td>
            <td>₱${totals.hor.toFixed(2)}</td>
            <td>₱${totals.soc.toFixed(2)}</td>
            <td>₱${totals.sundayschool.toFixed(2)}</td>
            <td>₱${totals.for_visitor.toFixed(2)}</td>
            <td>₱${totals.amd.toFixed(2)}</td>
            <td>₱${totals.others.toFixed(2)}</td>
            <td></td>
        </tr>
    `;

    const totalIncome = Object.values(totals).reduce((sum, val) => sum + val, 0);
    document.getElementById("overall-income-total").textContent = `Overall: ₱${totalIncome.toLocaleString()}`;
}

//editing entry
let editingEntryId = null;

function editEntry(id) {
    fetch(`/api/entries?date=${document.getElementById("entry-date").value}`)
        .then(res => res.json())
        .then(entries => {
            const entry = entries.find(e => e._id === id);
            if (!entry) return;
            editingEntryId = id;
            document.getElementById("form-date").value = entry.date || "";
            document.getElementById("name").value = entry.name || "";
            document.getElementById("tithes").value = entry.tithes || "";
            document.getElementById("offering").value = entry.offering || "";
            document.getElementById("sfc").value = entry.sfc || "";
            document.getElementById("fp").value = entry.fp || "";
            document.getElementById("ph").value = entry.ph || "";
            document.getElementById("hor").value = entry.hor || "";
            document.getElementById("soc").value = entry.soc || "";
            document.getElementById("sundayschool").value = entry.sundayschool || "";
            document.getElementById("for_visitor").value = entry.for_visitor || "";
            document.getElementById("amd").value = entry.amd || "";
            document.getElementById("others").value = entry.others || "";
            document.getElementById("other-label").value = entry.others_label || "";
            // Change form action and button text
            document.getElementById("offering-form").action = `/edit/${id}`;
            document.querySelector("#offering-form button[type='submit']").textContent = "Update Entry";
            
            // Scroll to the form
            document.getElementById("offering-form").scrollIntoView({ behavior: "smooth", block: "center" });
        });
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
            updateCashOnHand();
        })
        .catch(err => console.error("Delete error:", err));
}

function formatDatePretty(dateString) {
    const date = new Date(dateString);
    const options = { year: "numeric", month: "long", day: "numeric" };
    return date.toLocaleDateString("en-US", options);
}

// Load summary and expenses table

const categories = [
    "offering", "fp", "hor",
    "soc", "sundayschool", "for_visitor", "amd", "others"
];


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
    //

    const originalTotals = {};
    const expenseTotals = {};
    categories.forEach(cat => {
        originalTotals[cat] = entries.reduce((sum, e) => sum + (parseFloat(e[cat]) || 0), 0);
        expenseTotals[cat] = 0;
    });

    // Original total row
    let totalRow = `<tr><td>-</td><td><b>Original Total</b></td>`;
    categories.forEach(cat => {
        totalRow += `<td><b>₱${originalTotals[cat].toLocaleString()}</b></td>`;
    });
    totalRow += `<td>-</td></tr>`;
    summaryBody.innerHTML += totalRow;

    // Expense rows
    expenses.forEach((e, i) => {
        if (expenseTotals[e.from] !== undefined) {
            expenseTotals[e.from] += parseFloat(e.amount) || 0;
        }

        let row = `<tr><td>${i + 1}</td><td>-</td>`;
        categories.forEach(cat => {
            if (cat === e.from) {
                row += `<td style="color:red;">-₱${parseFloat(e.amount).toFixed(2)} (${e.label})</td>`;
            } else {
                row += `<td></td>`;
            }
        });
        const editBtn = `<button onclick="openEditExpenseModal('${e._id}')" style="background:#3498db; color: white; border:none; padding:4px 10px; border-radius:4px; cursor:pointer; flex:1;">Edit</button>`;
        const deleteBtn = `<button onclick="deleteExpense('${e._id}')" style="background-color: #e74c3c; color: white; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; flex:1;">Delete</button>`;
        row += `<td style="display:flex; gap:10px; justify-content:center;">${editBtn}${deleteBtn}</td></tr>`;

        summaryBody.innerHTML += row;
    });


    // Total Expenses row
    let expenseTotalRow = `<tr><td>-</td><td><b>Total Expenses</b></td>`;
    categories.forEach(cat => {
        expenseTotalRow += `<td><b>₱${expenseTotals[cat].toLocaleString()}</b></td>`;
    });
    expenseTotalRow += `<td>-</td></tr>`;
    summaryBody.innerHTML += expenseTotalRow;

    // Final cash on hand row
    let finalRow = `<tr><td>-</td><td><b>Cash on Hand</b></td>`;
    categories.forEach(cat => {
        const orig = originalTotals[cat] || 0;
        const exp = expenseTotals[cat] || 0;
        const remaining = orig - exp;
        finalRow += `<td><b>₱${remaining.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></td>`;
    });
    finalRow += `<td>-</td></tr>`;
    summaryBody.innerHTML += finalRow;


    const totalIncome = Object.values(originalTotals).reduce((sum, val) => sum + val, 0);
    const totalFinal = categories.reduce((acc, cat) => acc + (originalTotals[cat] - expenseTotals[cat]), 0);

    document.getElementById("overall-income-total").textContent = `Total Givings: ₱${totalIncome.toLocaleString()}`;
    document.getElementById("overall-final-total").textContent = `Total After Expenses: ₱${totalFinal.toLocaleString()}`;

}

//Editing Expenses 
let editingExpenseId = null;

// Open modal for adding
function openAddExpenseModal() {
    editingExpenseId = null;
    document.querySelector("#expenses-modal h3").textContent = "Add Expense";
    document.querySelector("#expense-form").reset();
    document.getElementById("expenses-modal").style.display = "block";
}

// Open modal for editing
function openEditExpenseModal(id) {
    const date = document.getElementById("entry-date").value;
    fetch(`/api/expenses?date=${date}`)
        .then(res => res.json())
        .then(expenses => {
            const expense = expenses.find(e => e._id === id);
            if (!expense) return;
            editingExpenseId = expense._id;
            document.querySelector("#expenses-modal h3").textContent = "Edit Expense";
            document.querySelector("#expense-form [name='amount']").value = expense.amount;
            document.querySelector("#expense-form [name='label']").value = expense.label;
            document.querySelector("#expense-form [name='from']").value = expense.from;
            document.getElementById("expenses-modal").style.display = "block";
        });
}

// Handle form submit
document.getElementById("expense-form").onsubmit = function(e) {
    e.preventDefault();
    const form = e.target;
    const data = {
        amount: form.amount.value,
        label: form.label.value,
        from: form.from.value,
        date: document.getElementById("entry-date").value
    };
    if (editingExpenseId) {
        // Edit
        fetch(`/edit-expense/${editingExpenseId}`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams(data)
        }).then(() => {
            document.getElementById("expenses-modal").style.display = "none";
            loadSummaryWithExpenses();
        });
    } else {
        // Add
        fetch("/add-expense", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        }).then(() => {
            document.getElementById("expenses-modal").style.display = "none";
            loadSummaryWithExpenses();
        });
    }
};

// Close modal
document.getElementById("close-expenses-modal").onclick = function() {
    document.getElementById("expenses-modal").style.display = "none";
};
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
    const cashDisplay = document.getElementById("offering-cash");  // ✅ define it properly

    modal.style.display = "block";
    tbody.innerHTML = "";
    let totalGivings = 0;
    let totalExpenses = 0;
    let totalCash = 0;

    try {
        const res = await fetch("/api/alltime-summary");
        const raw = await res.json();
        const data = Array.isArray(raw) ? raw : (raw.summary || []);

        data.sort((a, b) => new Date(b.date) - new Date(a.date));

        data.forEach(record => {
            const datePretty = formatDatePretty(record.date);
            const givings = record.givings || {};
            const expenses = Array.isArray(record.expenses) ? record.expenses : [];
            const totalGiving = record.total_givings || 0;
            const totalExpense = record.total_expenses || 0;
            const cashOnHand = totalGiving - totalExpense;

            totalGivings += totalGiving;
            totalExpenses += totalExpense;
            totalCash += cashOnHand;

            let html = `<tr><td colspan="4"><b>Date: ${datePretty}</b></td></tr>`;
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

            html += `<tr><td colspan="4"><u>Givings:</u></td></tr>`;
            Object.entries(givings).forEach(([key, value]) => {
                html += `<tr>
                    <td></td>
                    <td colspan="2">${key}</td>
                    <td>₱${parseFloat(value).toLocaleString()}</td>
                </tr>`;
            });

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



    } catch (err) {
        console.error("Summary fetch error:", err);
        tbody.innerHTML = `<tr><td colspan="4">Error loading summary.</td></tr>`;
    }
}

function updateCashOnHand() {
    fetch("/api/alltime-summary")
        .then(res => res.json())
        .then(data => {
            const summary = data.summary || [];

            let totalOffering = 0;
            let totalOfferingExpenses = 0;

            summary.forEach(day => {
                const offering = parseFloat(day.givings?.offering || 0);
                totalOffering += offering;

                const expensesForOffering = Array.isArray(day.expenses)
                    ? day.expenses
                        .filter(exp => exp.from === "offering")
                        .reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0)
                    : 0;

                totalOfferingExpenses += expensesForOffering;
            });

            const tithesCut = totalOffering * 0.10;
            const crvCut = totalOffering * 0.10;
            const netCash = totalOffering - tithesCut - crvCut - totalOfferingExpenses;

            const formattedCash = netCash.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2    
            });

            document.getElementById("offering-cash").innerText = `Cash on Hand (Offering): ₱${formattedCash}`;
        })
        .catch(err => {
            console.error("Cash summary fetch failed:", err);
            document.getElementById("alltime-cash").innerText = "Cash on Hand (Offering): ₱0.00";
        });
}
