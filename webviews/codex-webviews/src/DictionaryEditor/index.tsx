// FIXME: this is a work in progress webview. It should probably be converted to a React app. However, we need to populate the data grid with raw HTML + VS Code Webview UI Toolkit, which is lacking documentation and examples... and official support. 

import {
    provideVSCodeDesignSystem,
    vsCodeDataGrid,
    vsCodeDataGridCell,
    vsCodeDataGridRow,
    DataGrid,
    DataGridCell,
    vsCodeTextField,
    vsCodeButton,
    Button,
    vsCodePanels,
    vsCodePanelTab,
    vsCodePanelView,
} from "@vscode/webview-ui-toolkit";
import { DictionaryEntry } from "codex-types";

provideVSCodeDesignSystem().register(
    vsCodeDataGrid(),
    vsCodeDataGridCell(),
    vsCodeDataGridRow(),
    vsCodeTextField(),
    vsCodeButton(),
    vsCodePanels(),
    vsCodePanelTab(),
    vsCodePanelView(),
);

// Declare vscode at the top level
const vscode = acquireVsCodeApi();

window.addEventListener("load", main);

function main() {
    // Request initial data from the extension
    vscode.postMessage({ command: "getInitialData" });

    // Listen for messages from the extension
    window.addEventListener("message", (event) => {
        const message = event.data;
        switch (message.command) {
            case "setInitialData":
                initializeDataGrid(message.data);
                break;
        }
    });

    initializeDeleteConfirmationBanner();
}

function initializeDataGrid(data: DictionaryEntry[]) {
    const basicDataGrid = document.getElementById("basic-grid") as DataGrid;

    if (!data || !Array.isArray(data) || data.length === 0) {
        console.error("Invalid or empty data received");
        return;
    }

    basicDataGrid.rowsData = data;

    const uniqueColumnKeys = Array.from(
        new Set(data.flatMap((entry) => Object.keys(entry))),
    ).filter(
        (column: string) =>
            column !== "id" && // don't want to see this column
            column !== "hash", // don't want to see this column
    );

    basicDataGrid.columnDefinitions = uniqueColumnKeys.map(
        (column: string) => ({
            columnDataKey: column,
            title: column,
        }),
    );

    createFilterToolbar(uniqueColumnKeys, basicDataGrid);
    initEditableDataGrid("basic-grid");
}

function createFilterToolbar(columns: string[], grid: DataGrid) {
    const toolbar = document.createElement("div");
    toolbar.id = "filter-toolbar";
    toolbar.style.display = "flex";
    toolbar.style.gap = "10px";
    toolbar.style.marginBottom = "10px";

    columns.forEach((column) => {
        const filterInput = document.createElement(
            "vscode-text-field",
        ) as HTMLInputElement;
        filterInput.placeholder = `Filter ${column}`;
        filterInput.addEventListener("input", () => applyFilters(grid));
        toolbar.appendChild(filterInput);
    });

    const clearFiltersButton = document.createElement("vscode-button") as Button;
    clearFiltersButton.innerHTML = "Clear Filters";
    clearFiltersButton.onclick = () => clearFilters(grid);
    toolbar.appendChild(clearFiltersButton);

    const deleteAllButton = document.createElement("vscode-button") as Button;
    deleteAllButton.innerHTML = "Delete All";
    deleteAllButton.setAttribute("appearance", "secondary");
    deleteAllButton.onclick = () => showDeleteAllConfirmation();
    toolbar.appendChild(deleteAllButton);

    const gridContainer = document.getElementById("basic-grid")!.parentElement!;
    gridContainer.insertBefore(toolbar, gridContainer.firstChild);
}

function applyFilters(grid: DataGrid) {
    const filterInputs = Array.from(
        document.querySelectorAll("#filter-toolbar vscode-text-field"),
    ) as HTMLInputElement[];
    const filters = filterInputs.map((input, index) => ({
        column: grid.columnDefinitions?.[index].columnDataKey as string,
        value: input.value.toLowerCase(),
    }));

    const allData = grid.rowsData as DictionaryEntry[];
    const filteredData = allData.filter((entry) =>
        filters.every((filter) =>
            String(entry[filter.column as keyof DictionaryEntry])
                .toLowerCase()
                .includes(filter.value),
        ),
    );

    grid.rowsData = filteredData;
}

function clearFilters(grid: DataGrid) {
    const filterInputs = Array.from(
        document.querySelectorAll("#filter-toolbar vscode-text-field"),
    ) as HTMLInputElement[];
    filterInputs.forEach(input => input.value = "");
    grid.rowsData = grid.rowsData as DictionaryEntry[]; // Reset to all data
}

function showDeleteAllConfirmation() {
    const banner = document.getElementById('delete-confirmation-banner');
    if (banner) {
        banner.style.display = 'flex';
        const message = banner.querySelector('#delete-message') as HTMLElement;
        if (message) {
            message.textContent = "Are you sure you want to delete all entries?";
        }
        const confirmButton = banner.querySelector('vscode-button[appearance="secondary"]') as Button;
        confirmButton.onclick = deleteAllEntries;
    }
}

function deleteAllEntries() {
    const grid = document.getElementById("basic-grid") as DataGrid;
    grid.rowsData = [];
    updateData();
    hideBanner();
}

function initEditableDataGrid(id: string) {
    const grid = document.getElementById(id) as DataGridCell;
    grid?.addEventListener("cell-focused", (e: Event) => {
        const cell = e.target as DataGridCell;
        // Do not continue if `cell` is undefined/null or is not a grid cell
        if (!cell || cell.role !== "gridcell") {
            return;
        }
        // Do not allow data grid header cells to be editable
        if (cell.className === "column-header") {
            return;
        }

        // Note: Need named closures in order to later use removeEventListener
        // in the handleBlurClosure function
        const handleKeydownClosure = (e: KeyboardEvent) => {
            handleKeydown(e, cell);
        };
        const handleClickClosure = () => {
            setCellEditable(cell);
            unsetCellEditable(cell);
        };
        const handleBlurClosure = () => {
            syncCellChanges(cell);
            unsetCellEditable(cell);
            // Remove the blur, keydown, and click event listener _only after_
            // the cell is no longer focused
            cell.removeEventListener("blur", handleBlurClosure);
            cell.removeEventListener("keydown", handleKeydownClosure);
            cell.removeEventListener("click", handleClickClosure);
        };

        cell.addEventListener("keydown", handleKeydownClosure);
        // Run the click listener once so that if a cell's text is clicked a
        // second time the cursor will move to the given position in the string
        // (versus reselecting the cell text again)
        cell.addEventListener("click", handleClickClosure, { once: true });
        cell.addEventListener("blur", handleBlurClosure);
    });
}

// Make a given cell editable
function setCellEditable(cell: DataGridCell) {
    cell.setAttribute("contenteditable", "true");
    selectCellText(cell);
}

// Handle keyboard events on a given cell
function handleKeydown(e: KeyboardEvent, cell: DataGridCell) {
    if (
        !cell.hasAttribute("contenteditable") ||
        cell.getAttribute("contenteditable") === "false"
    ) {
        if (e.key === "Enter") {
            e.preventDefault();
            setCellEditable(cell);
            syncCellChanges(cell);
        }
    } else {
        if (e.key === "Enter" || e.key === "Escape") {
            e.preventDefault();
            syncCellChanges(cell);
            unsetCellEditable(cell);
        }
    }
}

// Make a given cell non-editable
function unsetCellEditable(cell: DataGridCell) {
    cell.setAttribute("contenteditable", "false");
    deselectCellText();
}

// Select the text of an editable cell
function selectCellText(cell: DataGridCell) {
    const selection = window.getSelection();
    if (selection) {
        const range = document.createRange();
        range.selectNodeContents(cell);
        selection.removeAllRanges();
        selection.addRange(range);
    }
}

// Deselect the text of a cell that was previously editable
function deselectCellText() {
    const selection = window.getSelection();
    if (selection) {
        selection.removeAllRanges();
    }
}

let pendingDeleteEntry: DictionaryEntry | null = null;
let pendingDeleteCell: DataGridCell | null = null;

function syncCellChanges(cell: DataGridCell) {
    const column = cell.columnDefinition;
    const row = cell.rowData;

    if (column && row) {
        const originalValue = row[column.columnDataKey as keyof typeof row];
        const newValue = cell.innerText.trim();

        console.log(`Syncing cell changes: Original value: "${originalValue}", New value: "${newValue}"`);

        if (originalValue !== newValue) {
            if (column.columnDataKey === "headWord" && newValue === "") {
                showDeleteConfirmation(row as DictionaryEntry, cell, originalValue as string);
            } else {
                (row[column.columnDataKey as keyof typeof row] as any) = newValue;
                updateData();
                console.log(`Updated ${column.columnDataKey} to "${newValue}"`);
            }
        }
    }
}

function createDeleteConfirmationBanner(): HTMLElement {
    const banner = document.createElement('div');
    banner.id = 'delete-confirmation-banner';
    banner.style.display = 'none';
    banner.style.position = 'fixed';
    banner.style.top = '0';
    banner.style.left = '0';
    banner.style.right = '0';
    banner.style.padding = '10px 20px';
    banner.style.backgroundColor = 'var(--vscode-editorWarning-background)';
    banner.style.color = 'var(--vscode-editorWarning-foreground)';
    banner.style.zIndex = '1000';
    banner.style.display = 'flex';
    banner.style.justifyContent = 'space-between';
    banner.style.alignItems = 'center';
    banner.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.2)';

    const messageContainer = document.createElement('div');
    messageContainer.style.flex = '1';

    const message = document.createElement('span');
    message.id = 'delete-message';
    message.style.fontWeight = 'bold';
    messageContainer.appendChild(message);

    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '10px';
    
    const confirmButton = document.createElement('vscode-button') as Button;
    confirmButton.innerHTML = 'Confirm';
    confirmButton.setAttribute('appearance', 'secondary');
    confirmButton.onclick = () => {
        if (pendingDeleteEntry) {
            deleteEntry(pendingDeleteEntry);
            hideBanner();
        }
    };

    const cancelButton = document.createElement('vscode-button') as Button;
    cancelButton.innerHTML = 'Cancel';
    cancelButton.onclick = () => {
        if (pendingDeleteCell) {
            pendingDeleteCell.innerText = pendingDeleteEntry?.headWord || '';
        }
        hideBanner();
    };

    buttonContainer.appendChild(cancelButton);
    buttonContainer.appendChild(confirmButton);

    banner.appendChild(messageContainer);
    banner.appendChild(buttonContainer);

    return banner;
}

function initializeDeleteConfirmationBanner() {
    const banner = createDeleteConfirmationBanner();
    document.body.insertBefore(banner, document.body.firstChild);
}

function showDeleteConfirmation(entry: DictionaryEntry, cell: DataGridCell) {
    pendingDeleteEntry = entry;
    pendingDeleteCell = cell;

    const banner = document.getElementById('delete-confirmation-banner');
    if (banner) {
        banner.style.display = 'flex';
        const message = banner.querySelector('#delete-message') as HTMLElement;
        if (message) {
            message.textContent = `Are you sure you want to delete the entry "${entry.headWord}"?`;
        }
        const confirmButton = banner.querySelector('vscode-button[appearance="secondary"]') as Button;
        confirmButton.onclick = () => {
            if (pendingDeleteEntry) {
                deleteEntry(pendingDeleteEntry);
                hideBanner();
            }
        };
    }
}

function deleteEntry(entry: DictionaryEntry) {
    console.log(`Deleting entry with headWord: "${entry.headWord}"`);
    console.log(`Attempting to delete entry: `, entry);
    const grid = document.getElementById("basic-grid") as DataGrid;
    const originalLength = (grid.rowsData as DictionaryEntry[]).length;
    const updatedRowsData = (grid.rowsData as DictionaryEntry[]).filter(
        (rowEntry) => rowEntry.id !== entry.id
    );
    console.log(`Filtered rowsData. Original length: ${originalLength}, New length: ${updatedRowsData.length}`);
    grid.rowsData = updatedRowsData;
    updateData();
    console.log(`Entry deleted. Remaining entries: ${updatedRowsData.length}`);
}

function updateData() {
    const grid = document.getElementById("basic-grid") as DataGrid;
    vscode.postMessage({ command: "updateData", data: grid.rowsData });
    console.log("Data updated and sent to extension");
}

function hideBanner() {
    const banner = document.getElementById('delete-confirmation-banner');
    if (banner) {
        banner.style.display = 'none';
    }
    pendingDeleteEntry = null;
    pendingDeleteCell = null;
}
