const categorySelect = document.getElementById("category-select");
const tableBody = document.getElementById("category-table-body");
const categoryTitle = document.getElementById("category-title");
const cashDisplay = document.getElementById("cash-on-hand");

async function fetchCategoryData(category) {
    const res = await fetch(`/api/category-history/${category}`);
    const data = await res.json();

    data.sort((a, b) => {
        // Skip "Cash on Hand" rows for comparison
        if (a.date === "-" || b.date === "-") return 0;

        return new Date(b.date) - new Date(a.date);
    });

    tableBody.innerHTML = "";
    categoryTitle.textContent = category.charAt(0).toUpperCase() + category.slice(1);

    let totalCash = 0;

    data.forEach(entry => {
        const type = entry.type.toLowerCase();
        const isCashRow = entry.type === "Cash on Hand";
        const isTotalGiving = type.toLowerCase().includes("total giving");
        const isTotalExpenses = type.toLowerCase().includes("total expenses");
        const isTotalDeduction = type.toLowerCase().includes("total deduction");

        const isNegative = !isTotalGiving; // Treat as negative if not Total Giving
        let amountClass = isTotalGiving ? 'text-green' : 'text-red';
        if (isTotalExpenses || isTotalDeduction) amountClass = 'text-orange';


        let amountValue = parseFloat(entry.amount).toFixed(2);
        let displayAmount = isNegative ? `-₱${amountValue}` : `₱${amountValue}`;

        if (isCashRow) {
            totalCash = parseFloat(entry.amount);
            return; // Skip adding Cash on Hand to the table
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
        `;
        tableBody.appendChild(tr);
    });

    cashDisplay.textContent = `Cash on Hand: ₱${totalCash.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

}

// Handle dropdown change
categorySelect.addEventListener("change", () => {
    const selected = categorySelect.value;
    fetchCategoryData(selected);
});

// Initial load
window.addEventListener("DOMContentLoaded", () => {
    fetchCategoryData(categorySelect.value);
});
