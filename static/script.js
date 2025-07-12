let entries = {};
let editIndex = null;

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("offering-form");
    const tableBody = document.querySelector("#entries-table tbody");
    const dateInput = document.getElementById("entry-date");
    const selectedDateDisplay = document.getElementById("selected-date");

    const urlParams = new URLSearchParams(window.location.search);
    const dateFromUrl = urlParams.get("date");
    const today = new Date().toISOString().split("T")[0];
    const selectedDate = dateFromUrl || today;

    dateInput.value = selectedDate;
    selectedDateDisplay.textContent = selectedDate;
    fetchEntries(selectedDate);


    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const date = dateInput.value;
        const rowData = getFormData();

        const formData = new FormData();
        formData.append("date", date);
        for (const key in rowData) {
            formData.append(key === "otherLabel" ? "others_label" : key, rowData[key]);
        }

        const res = await fetch("/", {
            method: "POST",
            body: formData,
        });

        if (res.redirected) {
            window.location.href = res.url;  // reload with selected date
        } else {
            fetchEntries(date);
        }

        form.reset();
    });

    document.getElementById("download-btn").addEventListener("click", () => {
        const date = dateInput.value;
        if (!entries[date] || entries[date].length === 0) {
            alert("No data to download for this date.");
            return;
        }

        let csv = "Name,Tithes,Offering,SFC,FP,PH,HOR,SOC,Others Label,Others\n";
        entries[date].forEach(row => {
            csv += `${row.name},${row.tithes},${row.offering},${row.sfc},${row.fp},${row.ph},${row.hor},${row.soc},${row.others_label},${row.others}\n`;
        });

        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${date}_offerings.csv`;
        a.click();
        URL.revokeObjectURL(url);
    });

    async function fetchEntries(date) {
        const res = await fetch(`/api/entries?date=${date}`);
        const data = await res.json();
        entries[date] = data;
        updateTable(date);
    }

    function updateTable(date) {
        const tableData = entries[date] || [];
        tableBody.innerHTML = "";

        let totals = {
            tithes: 0, offering: 0, sfc: 0, fp: 0,
            ph: 0, hor: 0, soc: 0, others: 0
        };

        tableData.forEach((row, index) => {
            totals.tithes += row.tithes;
            totals.offering += row.offering;
            totals.sfc += row.sfc;
            totals.fp += row.fp;
            totals.ph += row.ph;
            totals.hor += row.hor;
            totals.soc += row.soc;
            totals.others += row.others;

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${index + 1}</td>
                <td>${row.name}</td>
                <td>${row.tithes}</td>
                <td>${row.offering}</td>
                <td>${row.sfc}</td>
                <td>${row.fp}</td>
                <td>${row.ph}</td>
                <td>${row.hor}</td>
                <td>${row.soc}</td>
                <td>${row.others} (${row.others_label || "N/A"})</td>
                <td>
                    <button onclick="editEntry(${index})">Edit</button>
                    <button onclick="deleteEntry(${index})">Delete</button>
                </td>
            `;
            tableBody.appendChild(tr);
        });

        document.getElementById("total-tithes").textContent = totals.tithes;
        document.getElementById("total-offering").textContent = totals.offering;
        document.getElementById("total-sfc").textContent = totals.sfc;
        document.getElementById("total-fp").textContent = totals.fp;
        document.getElementById("total-ph").textContent = totals.ph;
        document.getElementById("total-hor").textContent = totals.hor;
        document.getElementById("total-soc").textContent = totals.soc;
        document.getElementById("total-others").textContent = totals.others;
    }
});

function getFormData() {
    return {
        name: document.getElementById("name").value.trim(),
        tithes: +document.getElementById("tithes").value || 0,
        offering: +document.getElementById("offering").value || 0,
        sfc: +document.getElementById("sfc").value || 0,
        fp: +document.getElementById("fp").value || 0,
        ph: +document.getElementById("ph").value || 0,
        hor: +document.getElementById("hor").value || 0,
        soc: +document.getElementById("soc").value || 0,
        others: +document.getElementById("others").value || 0,
        otherLabel: document.getElementById("other-label").value.trim(),
    };
}
const tfoot = document.querySelector("#entries-table tfoot");
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
        <td>${totals.others}</td>
        <td></td>
    </tr>
`;
document.getElementById("download-jpg").addEventListener("click", async () => {
    const tableWrapper = document.querySelector(".table-wrapper");
    if (!tableWrapper) return;

    tableWrapper.scrollLeft = 0;  // ensure full scroll area is visible
    tableWrapper.style.overflow = "visible"; // make sure nothing is hidden

    const canvas = await html2canvas(tableWrapper, {
        scrollX: 0,
        scrollY: -window.scrollY,
        windowWidth: document.body.scrollWidth,
        useCORS: true
    });

    const link = document.createElement("a");
    const date = document.getElementById("entry-date").value;
    link.download = `Report_${date || 'today'}.jpg`;
    link.href = canvas.toDataURL("image/jpeg");
    link.click();
});
