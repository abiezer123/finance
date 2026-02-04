let categorySelect, tableBody, categoryTitle, cashDisplay;
let modal, modalCategoryName, modalCategorySelect, expenseForm, closeModalBtn, addExpenseBtn;

// Initialize elements function
function initializeElements() {
    categorySelect = document.getElementById("category-select");
    tableBody = document.getElementById("category-table-body");
    categoryTitle = document.getElementById("category-title");
    cashDisplay = document.getElementById("cash-on-hand");

    modal = document.getElementById("expense-modal");
    modalCategoryName = document.getElementById("modal-category-name");
    modalCategorySelect = document.getElementById("modal-category-select");
    expenseForm = document.getElementById("expense-form");
    closeModalBtn = document.getElementById("close-expense-modal");
    addExpenseBtn = document.getElementById("add-expense-btn");
}

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
// Open modal (safe check if button exists)
function setupModalListeners() {
    if (addExpenseBtn) {
        addExpenseBtn.addEventListener("click", () => {
            if (typeof closeAllModals === "function") closeAllModals();
            modalCategorySelect.style.display = "block";
            modal.style.display = "block";
            modalCategoryName.textContent = currentCategory.charAt(0).toUpperCase() + currentCategory.slice(1);
            modalCategorySelect.value = currentCategory;
            if (typeof updateFloatingButtonsVisibility === "function") updateFloatingButtonsVisibility();
        });
    }

    // Close modal
    if (closeModalBtn) {
        closeModalBtn.addEventListener("click", () => {
            modal.style.display = "none";
            if (typeof updateFloatingButtonsVisibility === "function") updateFloatingButtonsVisibility();
        });
    }
}




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
    if (modal && event.target === modal) {
        modal.style.display = "none";
        if (typeof updateFloatingButtonsVisibility === "function") updateFloatingButtonsVisibility();
    }
});

// Submit expense
// Logic moved to ensure form exists
function setupExpenseForm() {
    if (expenseForm) {
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
                    if (typeof updateFloatingButtonsVisibility === "function") updateFloatingButtonsVisibility();
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
                    if (typeof updateFloatingButtonsVisibility === "function") updateFloatingButtonsVisibility();
                    expenseForm.reset();
                    fetchCategoryData(currentCategory);
                } else {
                    alert("Failed to add manual expense.");
                }
            }

            modal.removeAttribute("data-mode");
        });
    }
}




// Fetch and render category data
async function fetchCategoryData(category) {
    if (!tableBody) tableBody = document.getElementById("category-table-body");
    if (!tableBody) { console.error("Critical: Table body element not found."); return; }

    if (!categoryTitle) categoryTitle = document.getElementById("category-title");
    if (!cashDisplay) cashDisplay = document.getElementById("cash-on-hand");

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
        const isDeletable = entry.source === "manual";

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${entry.date}</td>
            <td><strong>${entry.type}</strong></td>
            <td class="${amountClass}"><strong>${displayAmount}</strong></td>
            <td>${entry.label || "-"}</td>
            <td>${expenses}</td>
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
                if (typeof closeAllModals === "function") closeAllModals();
                modalCategorySelect.style.display = "none";
                modal.style.display = "block";
                document.getElementById("modal-category-name").textContent = currentCategory;
                document.getElementById("modal-category-select").value = currentCategory;
                document.getElementById("expense-label").value = entry.label || "";
                document.getElementById("expense-amount").value = entry.amount;
                document.getElementById("modal-expense-id").value = getEntryId(entry);
                modal.setAttribute("data-mode", "edit");
                if (typeof updateFloatingButtonsVisibility === "function") updateFloatingButtonsVisibility();
            });
        }

        tableBody.appendChild(tr);
    });

    cashDisplay.textContent = `Cash on Hand: ₱${totalCash.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}


// Year Population Logic
let cachedYears = null;

async function fetchAvailableYears() {
    if (cachedYears) return cachedYears;
    try {
        const res = await fetch("/api/available-years");
        cachedYears = await res.json();
        // Ensure current year is in list if not present (handled by backend but good to have safety)
        const curYear = new Date().getFullYear().toString();
        // Check manually to avoid simple includes if types differ (backend returns strings?)
        if (!cachedYears.includes(curYear)) {
            cachedYears.push(curYear);
            cachedYears.sort().reverse();
        }
        return cachedYears;
    } catch (e) {
        console.error("Failed to fetch years", e);
        return [new Date().getFullYear().toString()];
    }
}

async function fillYearSelect(targetSelect, isOptional = false) {
    if (!targetSelect) return;
    const years = await fetchAvailableYears();

    // Clear
    targetSelect.innerHTML = "";

    // Optional / Default Option
    if (isOptional) {
        const opt = document.createElement("option");
        opt.value = "";
        opt.textContent = "-- Year --";
        targetSelect.appendChild(opt);
    } else {
        // For main selector, we might want "Year" label or just current year?
        // Current logic expects just years. 
        // But Search modal had <option value="">All Years</option>
        // Check if targetSelect has specific ID to decide?
        if (targetSelect.id === "search-year-select") {
            const opt = document.createElement("option");
            opt.value = "";
            opt.textContent = "All Years";
            targetSelect.appendChild(opt);
        }
    }

    years.forEach(year => {
        const opt = document.createElement("option");
        opt.value = year;
        opt.textContent = year;
        targetSelect.appendChild(opt);
    });

    // Set default value to current year if not "All Years" desired default
    // For main selector and modal start selector:
    if (!isOptional && targetSelect.id !== "search-year-select") {
        targetSelect.value = new Date().getFullYear().toString();
    }
}


// Handle dropdown change
function setupGlobalListeners() {
    if (categorySelect) {
        categorySelect.addEventListener("change", () => {
            currentCategory = categorySelect.value;
            fetchCategoryData(currentCategory);
        });
    }
}

// Initial load
window.addEventListener("DOMContentLoaded", () => {
    initializeElements();
    setupModalListeners();
    setupExpenseForm();
    setupGlobalListeners();

    const scrollBtn = document.getElementById("scroll-calculator-btn");
    const mainCalcBtn = document.getElementById("open-calculator");
    const scrollSearchBtn = document.getElementById("scroll-search-btn");
    const scrollLogBtn = document.getElementById("scroll-log-btn");
    const searchModal = document.getElementById("search-modal");
    const logModal = document.getElementById("log-modal");
    const searchYearSelect = document.getElementById("search-year-select");

    const printModalEl = document.getElementById("print-modal");
    const calcModal = document.getElementById("calculator-modal");

    // Central modal list and floating buttons (for close-all and visibility)
    const modalsList = [
        modal,
        printModalEl,
        calcModal,
        searchModal,
        logModal
    ];
    const floatingButtonsList = [scrollBtn, scrollSearchBtn, scrollLogBtn];

    function closeAllModals() {
        modalsList.forEach(function (m) {
            if (m) m.style.display = "none";
        });
    }
    function updateFloatingButtonsVisibility() {
        const anyOpen = modalsList.some(function (m) {
            if (!m) return false;
            const d = m.style.display;
            return d !== "none" && d !== "";
        });
        const isAtTop = window.scrollY <= 5;
        if (anyOpen || isAtTop) {
            floatingButtonsList.forEach(function (b) {
                if (b) b.style.display = "none";
            });
        } else {
            floatingButtonsList.forEach(function (b) {
                if (b) b.style.display = "flex";
            });
        }
    }

    // Expose for expense modal open/close (setupModalListeners, editBtn)
    window.closeAllModals = closeAllModals;
    window.updateFloatingButtonsVisibility = updateFloatingButtonsVisibility;

    // Prevent errors if buttons are missing
    if (!scrollBtn || !mainCalcBtn) return;

    // Show/hide floating buttons when scrolling (only when no modal is open)
    window.addEventListener("scroll", function () {
        updateFloatingButtonsVisibility();
    });
    updateFloatingButtonsVisibility();
    window.requestAnimationFrame(updateFloatingButtonsVisibility);

    // Trigger calculator on floating button click
    scrollBtn.addEventListener("click", function () {
        mainCalcBtn.click();
    });

    if (scrollSearchBtn && searchModal) {
        scrollSearchBtn.addEventListener("click", async function () {
            closeAllModals();
            searchModal.style.display = "flex";
            updateFloatingButtonsVisibility();
            if (searchYearSelect && searchYearSelect.options.length <= 1) {
                await fillYearSelect(searchYearSelect, true);
            }
        });
    }

    // Log modal: open, close, tabs, load data
    const closeLogBtn = document.getElementById("close-log-modal");
    const logTabDates = document.getElementById("log-tab-dates");
    const logTabActions = document.getElementById("log-tab-actions");
    const logPanelDates = document.getElementById("log-panel-dates");
    const logPanelActions = document.getElementById("log-panel-actions");
    const logDatesList = document.getElementById("log-dates-list");
    const logDatesEmpty = document.getElementById("log-dates-empty");
    const logActionsBody = document.getElementById("log-actions-body");
    const logActionsEmpty = document.getElementById("log-actions-empty");

    if (scrollLogBtn && logModal) {
        scrollLogBtn.addEventListener("click", function () {
            closeAllModals();
            logModal.style.display = "flex";
            updateFloatingButtonsVisibility();
            showLogTab("dates");
            loadLogDates();
        });
    }
    if (closeLogBtn && logModal) {
        closeLogBtn.addEventListener("click", function () {
            logModal.style.display = "none";
            updateFloatingButtonsVisibility();
        });
    }
    window.addEventListener("click", function (e) {
        if (e.target === logModal) {
            logModal.style.display = "none";
            updateFloatingButtonsVisibility();
        }
    });

    function formatLogDate(dateStr) {
        if (!dateStr) return "-";
        const d = new Date(dateStr + "T12:00:00");
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    }
    function formatLogTimestamp(isoStr) {
        if (!isoStr) return "-";
        const d = new Date(isoStr);
        if (isNaN(d.getTime())) return "-";
        const datePart = d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
        const timePart = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
        return datePart + ", " + timePart;
    }

    function showLogTab(tab) {
        const isDates = tab === "dates";
        logPanelDates.style.display = isDates ? "block" : "none";
        logPanelActions.style.display = isDates ? "none" : "block";
        if (logTabDates && logTabActions) {
            logTabDates.style.background = isDates ? "#5d6d7e" : "#4a5568";
            logTabDates.style.color = "#fff";
            logTabDates.style.fontWeight = isDates ? "600" : "normal";
            logTabActions.style.background = isDates ? "#4a5568" : "#5d6d7e";
            logTabActions.style.color = "#fff";
            logTabActions.style.fontWeight = isDates ? "normal" : "600";
        }
        if (!isDates) loadLogActions();
    }
    async function loadLogDates() {
        if (!logDatesList || !logDatesEmpty) return;
        logDatesList.innerHTML = "";
        logDatesEmpty.style.display = "none";
        try {
            const res = await fetch(`/api/dates-with-input?t=${Date.now()}`);
            const dates = await res.json();
            if (!dates || dates.length === 0) {
                logDatesEmpty.style.display = "block";
                return;
            }
            dates.forEach(function (d) {
                const li = document.createElement("li");
                li.style.padding = "8px 0";
                li.style.borderBottom = "1px solid #eee";
                li.textContent = formatLogDate(d);
                logDatesList.appendChild(li);
            });
        } catch (e) {
            console.error("Error loading log dates", e);
            logDatesEmpty.textContent = "Failed to load dates.";
            logDatesEmpty.style.display = "block";
        }
    }
    async function loadLogActions() {
        if (!logActionsBody || !logActionsEmpty) return;
        logActionsBody.innerHTML = "";
        logActionsEmpty.style.display = "none";
        try {
            const res = await fetch("/api/activity-logs");
            const logs = await res.json();
            if (!logs || logs.length === 0) {
                logActionsEmpty.style.display = "block";
                return;
            }
            logs.forEach(function (log) {
                const tr = document.createElement("tr");
                const when = log.timestamp ? formatLogTimestamp(log.timestamp) : "-";
                const action = (log.action || "").toLowerCase();
                const name = log.name || "-";
                const category = log.category || "-";
                const amount = log.amount != null ? "₱" + parseFloat(log.amount).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "-";
                const who = log.who || "-";
                tr.innerHTML =
                    "<td style=\"padding:10px; border:1px solid #ddd;\">" + when + "</td>" +
                    "<td style=\"padding:10px; border:1px solid #ddd;\">" + action + "</td>" +
                    "<td style=\"padding:10px; border:1px solid #ddd;\">" + name + "</td>" +
                    "<td style=\"padding:10px; border:1px solid #ddd;\">" + category + "</td>" +
                    "<td style=\"padding:10px; border:1px solid #ddd; text-align:right;\">" + amount + "</td>" +
                    "<td style=\"padding:10px; border:1px solid #ddd;\">" + who + "</td>";
                logActionsBody.appendChild(tr);
            });
        } catch (e) {
            console.error("Error loading activity logs", e);
            logActionsEmpty.textContent = "Failed to load actions.";
            logActionsEmpty.style.display = "block";
        }
    }
    if (logTabDates) logTabDates.addEventListener("click", function () { showLogTab("dates"); });
    if (logTabActions) logTabActions.addEventListener("click", function () { showLogTab("actions"); });

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
        openCalcBtn.onclick = function () {
            closeAllModals();
            calcModal.style.display = "flex";
            updateFloatingButtonsVisibility();
        };
    }
    if (closeCalcBtn && calcModal) {
        closeCalcBtn.onclick = function () {
            calcModal.style.display = "none";
            updateFloatingButtonsVisibility();
        };
    }
    window.addEventListener("click", function (e) {
        if (e.target === calcModal) {
            calcModal.style.display = "none";
            updateFloatingButtonsVisibility();
        }
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
    const monthSelect = document.getElementById("month-select");
    const yearSelect = document.getElementById("year-select");
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
        const month = monthSelect.value;
        const year = yearSelect.value;
        if (!category || !month || !year) return;

        const dateParam = `${year}-${month}`;

        const res = await fetch(`/api/givings-per-person/${encodeURIComponent(category)}?month=${dateParam}`);
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

    async function populateYears(targetSelect) {
        // Legacy wrapper to use new global logic
        await fillYearSelect(targetSelect, false);
    }

    categorySelect.addEventListener("change", loadGivingsTable);
    monthSelect.addEventListener("change", loadGivingsTable);
    yearSelect.addEventListener("change", loadGivingsTable);

    // Initial load
    (async () => {
        await populateYears(yearSelect);
        const now = new Date();
        const m = (now.getMonth() + 1).toString().padStart(2, '0');
        monthSelect.value = m;
        loadGivingsTable();
    })();
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

const printModal = document.getElementById("print-modal");
const openModalBtn = document.getElementById("print-table-btn");
const cancelModalBtn = document.getElementById("modal-cancel-btn");
const printBtn = document.getElementById("modal-print-btn");


// Populate years in modal when opened
openModalBtn.addEventListener("click", async () => {
    if (typeof closeAllModals === "function") closeAllModals();
    printModal.style.display = "flex";
    if (typeof updateFloatingButtonsVisibility === "function") updateFloatingButtonsVisibility();

    // We can reuse the same fetch logic or endpoint
    // To avoid Scope issues with the 'populateYears' inside 'tableForNames', 
    // we just fetch directly here.
    // Use consolidated logic
    await fillYearSelect(document.getElementById("modal-start-year-select"), false);
    await fillYearSelect(document.getElementById("modal-end-year-select"), true);

    // Calls removed, handled above


    // Set default start month to current month? Or keep it blank?
    // Let's set start month to current month by default
    const now = new Date();
    document.getElementById("modal-start-month-select").value = (now.getMonth() + 1).toString().padStart(2, '0');
});

cancelModalBtn.addEventListener("click", () => {
    printModal.style.display = "none";
    if (typeof updateFloatingButtonsVisibility === "function") updateFloatingButtonsVisibility();
});

printBtn.addEventListener("click", async () => {
    const sMonth = document.getElementById("modal-start-month-select").value;
    const sYear = document.getElementById("modal-start-year-select").value;

    const eMonth = document.getElementById("modal-end-month-select").value;
    const eYear = document.getElementById("modal-end-year-select").value;

    if (!sMonth || !sYear) return alert("Please select a start month and year.");

    const startMonth = `${sYear}-${sMonth}`;
    let endMonth = startMonth;

    if (eMonth && eYear) {
        endMonth = `${eYear}-${eMonth}`;
    }

    printModal.style.display = "none"; // close modal
    if (typeof updateFloatingButtonsVisibility === "function") updateFloatingButtonsVisibility();

    function getMonths(start, end) {
        const startDate = new Date(start + "-01");
        const endDate = new Date(end + "-01");
        const months = [];
        let current = startDate;
        while (current <= endDate) {
            const m = current.getMonth() + 1;
            months.push(`${current.getFullYear()}-${m.toString().padStart(2, "0")}`);
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
                deductions["Tithes 10%"] = value * 0.1;
                deductions["Offering 30%"] = value * 0.3;
                deductions["CRV 10%"] = value * 0.1;
                deductions["Pastor 50%"] = value - (deductions["Tithes 10%"] + deductions["Offering 30%"] + deductions["CRV 10%"]);
                break;
            case "offering":
                deductions["Church Tithes 10%"] = value * 0.1;
                deductions["CRV 10%"] = value * 0.1;
                break;
            case "fp": case "hor":
                deductions["Tithes 10%"] = value * 0.1;
                deductions["HQ 45%"] = value * 0.45;
                break;
            case "sundayschool":
                deductions["Tithes 10%"] = value * 0.1;
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
        <html><head>
        <title>Empire - ${selectedCategory.toUpperCase()}</title>
        <style>
            table { width:100%; border-collapse:collapse; font-family:Arial; margin-bottom:30px; }
            th, td { border:1px solid #999; padding:6px 10px; text-align:left; }
            th { background-color:#4A90E2; color:white; }
            tbody tr:nth-child(even) { background-color:#fafafa; }
            tfoot tr { font-weight:bold; background-color:#f0f0f0; }
            td.total { background-color:#d1ffd1; }
            td.deduction { background-color:#FFDAB9; }
            h2 { margin-bottom:5px; }
        </style></head><body>`;

    for (const month of months) {
        try {
            const res = await fetch(`/api/givings-per-person/${selectedCategory}?month=${month}`);
            const data = await res.json();
            if (!data.dates || !data.data) continue;

            htmlContent += `<h2>Category: ${selectedCategory.toUpperCase()}</h2>`;
            htmlContent += `<h3>Month: ${formatMonth(month)}</h3>`;

            const sampleDeductions = calculateDeductions(1, selectedCategory);
            const deductionKeys = Object.keys(sampleDeductions);

            htmlContent += `<table><thead><tr><th>Name</th>`;
            data.dates.forEach(d => htmlContent += `<th>${formatDate(d)}</th>`);
            htmlContent += `<th>Total</th>`;
            deductionKeys.forEach(k => htmlContent += `<th>${k}</th>`);
            htmlContent += `</tr></thead><tbody>`;

            const totalsPerDate = {};
            data.dates.forEach(d => totalsPerDate[d] = 0);
            let totalsRow = {};
            deductionKeys.forEach(k => totalsRow[k] = 0);
            let grandTotal = 0;

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
                    deductionKeys.forEach(k => deductionsSum[k] += deductions[k] || 0);

                    htmlContent += `<td>${val !== 0 ? "₱" + val.toFixed(2) : ""}</td>`;
                });

                htmlContent += `<td class="total">${rowTotal !== 0 ? "₱" + rowTotal.toFixed(2) : ""}</td>`;
                deductionKeys.forEach(k => {
                    totalsRow[k] += deductionsSum[k];
                    htmlContent += `<td class="deduction">${deductionsSum[k] !== 0 ? "₱" + deductionsSum[k].toFixed(2) : ""}</td>`;
                });

                htmlContent += `</tr>`;
                grandTotal += rowTotal;
            });

            htmlContent += `<tfoot><tr><td>Total</td>`;
            data.dates.forEach(d => htmlContent += `<td>${totalsPerDate[d] !== 0 ? "₱" + totalsPerDate[d].toFixed(2) : ""}</td>`);
            htmlContent += `<td class="total">${grandTotal !== 0 ? "₱" + grandTotal.toFixed(2) : ""}</td>`;
            deductionKeys.forEach(k => htmlContent += `<td class="deduction">${totalsRow[k] !== 0 ? "₱" + totalsRow[k].toFixed(2) : ""}</td>`);
            htmlContent += `</tr></tfoot></table>`;

        } catch (err) {
            console.error("Error fetching month data:", month, err);
        }
    }

    htmlContent += `</body></html>`;

    const printWindow = window.open('', 'width=900,height=700');
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
});


// Search Modal Logic
const searchModal = document.getElementById("search-modal");
const closeSearchBtn = document.getElementById("close-search-modal");
const searchGoBtn = document.getElementById("search-go-btn");
const searchNameInput = document.getElementById("search-name-input");
const nameSuggestions = document.getElementById("name-suggestions");

// Outside Click Close for Search Modal
window.addEventListener("click", (e) => {
    if (e.target === searchModal) {
        searchModal.style.display = "none";
        if (typeof updateFloatingButtonsVisibility === "function") updateFloatingButtonsVisibility();
    }
});

const searchFilterType = document.getElementById("search-filter-type");
const filterYearContainer = document.getElementById("filter-year-container");
const filterMonthContainer = document.getElementById("filter-month-container");
const filterDateContainer = document.getElementById("filter-date-container");

const searchYearSelect = document.getElementById("search-year-select");
const searchMonthSelect = document.getElementById("search-month-select");
const searchDateInput = document.getElementById("search-date-input");
const searchResultsBody = document.getElementById("search-results-body");
const searchTotalSummary = document.getElementById("search-total-summary");

// Autocomplete and Auto-Search
// Autocomplete name suggestions (fetching only, search is handled by auto-search above)
if (searchNameInput && nameSuggestions) {
    // Fetch suggestions as user types
    let autocompleteFetchTimer = null;
    searchNameInput.addEventListener("input", async (e) => {
        const query = searchNameInput.value;
        if (query.length < 2) return; // Only fetch after 2 characters

        // Debounce autocomplete fetching
        clearTimeout(autocompleteFetchTimer);
        autocompleteFetchTimer = setTimeout(async () => {
            try {
                const res = await fetch(`/api/names?q=${encodeURIComponent(query)}`);
                const names = await res.json();

                nameSuggestions.innerHTML = "";
                names.forEach(name => {
                    const opt = document.createElement("option");
                    opt.value = name;
                    nameSuggestions.appendChild(opt);
                });
            } catch (e) {
                console.error("Error fetching names", e);
            }
        }, 200);
    });
}

// Filter Visibility
if (searchFilterType) {
    searchFilterType.addEventListener("change", () => {
        const type = searchFilterType.value;

        filterYearContainer.style.display = "none";
        filterMonthContainer.style.display = "none";
        filterDateContainer.style.display = "none";
        const filterCategoryContainer = document.getElementById("filter-category-container");
        if (filterCategoryContainer) filterCategoryContainer.style.display = "none";

        // Reset values (optional but cleaner)
        // searchYearSelect.value = "";
        // searchMonthSelect.value = "01";
        // searchDateInput.value = "";

        if (type === "year") {
            filterYearContainer.style.display = "block";
        } else if (type === "month") {
            filterYearContainer.style.display = "block";
            filterMonthContainer.style.display = "block";
        } else if (type === "date") {
            filterDateContainer.style.display = "block";
        } else if (type === "category") {
            if (filterCategoryContainer) filterCategoryContainer.style.display = "block";
        }
    });
}



if (closeSearchBtn) {
    closeSearchBtn.addEventListener("click", () => {
        searchModal.style.display = "none";
        if (typeof updateFloatingButtonsVisibility === "function") updateFloatingButtonsVisibility();
    });
}


// Debounce utility
let searchDebounceTimer = null;
function debounceSearch(callback, delay = 300) {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(callback, delay);
}

// Reusable search function
async function performSearch() {
    const name = searchNameInput.value.trim();
    if (!name) {
        searchResultsBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; color:#7f8c8d;">Enter a name to search...</td></tr>`;
        searchTotalSummary.textContent = "";
        return;
    }

    const filterType = searchFilterType.value;
    const year = searchYearSelect.value;
    const month = searchMonthSelect.value;
    const date = searchDateInput.value;
    const searchCategorySelect = document.getElementById("search-category-select");
    const category = searchCategorySelect ? searchCategorySelect.value : "";

    let url = `/api/search-givings?name=${encodeURIComponent(name)}`;

    if (filterType === "date" && date) {
        url += `&date=${date}`;
    } else if (filterType === "month") {
        if (year) url += `&year=${year}`;
        if (month) url += `&month=${month}`;
    } else if (filterType === "year") {
        if (year) url += `&year=${year}`;
    }
    // Category filtering is done client-side after fetching results

    try {
        const res = await fetch(url);
        let data = await res.json();

        // Filter by category if selected
        if (filterType === "category" && category) {
            data = data.filter(row => row.category === category);
        }

        searchResultsBody.innerHTML = "";
        let total = 0;

        if (data.length === 0) {
            searchResultsBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px;">No results found.</td></tr>`;
        } else {
            // Group by Week
            function getWeekStart(d) {
                const date = new Date(d);
                const day = date.getDay();
                const diff = date.getDate() - day;
                const weekStart = new Date(date.setDate(diff));
                return weekStart.toISOString().split('T')[0];
            }
            function formatDateFriendly(dStr) {
                const d = new Date(dStr);
                if (isNaN(d)) return dStr;
                return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
            }

            // Grouping
            const grouped = {};
            data.forEach(row => {
                total += row.amount;
                const ws = getWeekStart(row.date);
                if (!grouped[ws]) grouped[ws] = [];
                grouped[ws].push(row);
            });

            // Sort weeks descending
            const sortedWeeks = Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a));

            sortedWeeks.forEach(weekStart => {
                const rows = grouped[weekStart];
                const weekEnd = new Date(new Date(weekStart).getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

                // Week Header
                const headerRow = document.createElement("tr");
                headerRow.innerHTML = `
                    <td colspan="4" style="background-color:#d4e6f1; font-weight:bold; padding:10px;">
                        Week of ${formatDateFriendly(weekStart)} - ${formatDateFriendly(weekEnd)}
                    </td>
                `;
                searchResultsBody.appendChild(headerRow);

                rows.forEach(row => {
                    const tr = document.createElement("tr");
                    tr.innerHTML = `
                        <td style="padding:10px; border-bottom:1px solid #eee;">${formatDateFriendly(row.date)}</td>
                        <td style="padding:10px; border-bottom:1px solid #eee;">${row.name}</td>
                        <td style="padding:10px; border-bottom:1px solid #eee;">${row.category.toUpperCase()}</td>
                        <td style="padding:10px; border-bottom:1px solid #eee; text-align:right;">₱${row.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    `;
                    searchResultsBody.appendChild(tr);
                });
            });
        }

        searchTotalSummary.textContent = "";

    } catch (e) {
        console.error("Error searching:", e);
        searchResultsBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; color:#e74c3c;">Error searching givings.</td></tr>`;
    }
}

// Auto-search on name input (with debounce)
if (searchNameInput) {
    searchNameInput.addEventListener("input", () => {
        debounceSearch(performSearch);
    });
}

// Auto-search on filter type change
if (searchFilterType) {
    searchFilterType.addEventListener("change", () => {
        if (searchNameInput.value.trim()) {
            performSearch();
        }
    });
}

// Auto-search on year change
if (searchYearSelect) {
    searchYearSelect.addEventListener("change", () => {
        if (searchNameInput.value.trim()) {
            performSearch();
        }
    });
}

// Auto-search on month change
if (searchMonthSelect) {
    searchMonthSelect.addEventListener("change", () => {
        if (searchNameInput.value.trim()) {
            performSearch();
        }
    });
}

// Auto-search on date change
if (searchDateInput) {
    searchDateInput.addEventListener("change", () => {
        if (searchNameInput.value.trim()) {
            performSearch();
        }
    });
}

// Auto-search on category change
const searchCategorySelect = document.getElementById("search-category-select");
if (searchCategorySelect) {
    searchCategorySelect.addEventListener("change", () => {
        if (searchNameInput.value.trim()) {
            performSearch();
        }
    });
}


