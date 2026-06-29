/* Shared in-memory state loaded from toggle_action.php. */
let allContainers = [];
let allToggles = [];
let previousBulkStates = null;
let previousContainerStates = {};

/* Initial page load: get containers, toggles, and saved states from PHP. */
fetch('toggle_action.php?action=load')
.then(response => response.json())
.then(data => {
    allContainers = data.containers || [];
    allToggles = data.toggles || [];
    renderContainers();
});

/* Render every container and the cards that belong to it. */
function renderContainers() {
    let wrapper = document.getElementById('containersWrapper');
    wrapper.innerHTML = '';

    allContainers.forEach(container => {
        let toggles = getContainerToggles(container.id);

        wrapper.innerHTML += `
            <section
                class="toggle-container"
                data-container-id="${container.id}"
                data-container-name="${escapeAttribute(container.name.toLowerCase())}"
            >
                <div class="container-header">
                    <div class="title-container">
                        <h2
                            class="container-title"
                            contenteditable="true"
                            spellcheck="false"
                            onblur="saveContainerName(${container.id}, this.innerText)"
                            onkeydown="handleContainerNameKey(event)"
                        >${escapeHtml(container.name)}</h2>
                    </div>

                    <div class="container-meta">
                        <div class="container-count">
                            ${toggles.length} Toggle${toggles.length == 1 ? '' : 's'}
                        </div>

                        <button
                            class="delete-container-btn"
                            onclick="openDeleteContainerModal(${container.id})"
                            title="Delete container"
                        >
                            x
                        </button>
                    </div>
                </div>

                <div class="container-toolbar">
                    <input
                        type="text"
                        class="search-input container-search"
                        placeholder="🔍 Toggle by Name.."
                        onkeyup="filterToggles(${container.id}, this.value)"
                    >

                    <div class="toolbar-actions">
                        <button
                            onclick="openAddModal(${container.id})"
                            class="add-new-toggle-btn"
                        >
                            + Add New Toggle
                        </button>

                        <button
                            onclick="turnContainerToggles(${container.id}, 1)"
                            class="turnOnAll-btn"
                        >
                            Turn On All
                        </button>

                        <button
                            onclick="turnContainerToggles(${container.id}, 0)"
                            class="turnOffAll-btn"
                        >
                            Turn Off All
                        </button>

                        <button
                            onclick="resetContainerToggles(${container.id})"
                            class="resetAll-btn"
                        >
                            Reset
                        </button>
                    </div>
                </div>

                <div class="cards-grid" data-cards-container-id="${container.id}">
                    ${renderToggleCards(toggles)}
                </div>
            </section>
        `;
    });

    filterContainers();
}

/* Build the card HTML for one container. */
function renderToggleCards(toggles) {
    if (toggles.length == 0) {
        return '<div class="empty-message">No toggles in this container</div>';
    }

    return toggles.map(toggle => {
        let checked = toggle.state == 1 ? 'checked' : '';

        return `
            <div
                class="card"
                data-label="${escapeAttribute(toggle.label.toLowerCase())}"
            >
                <div class="toggle-name">${escapeHtml(toggle.label)}</div>

                <label class="switch">
                    <input
                        type="checkbox"
                        data-toggle-id="${toggle.id}"
                        ${checked}
                        onchange="toggleSwitch(${toggle.id}, this.checked)"
                    >
                    <span class="slider"></span>
                </label>

                <div class="card-actions">
                    <button
                        class="edit-btn"
                        onclick="openEditModal(${toggle.id})"
                    >
                        Edit
                    </button>

                    <button
                        class="delete-btn"
                        onclick="openDeleteModal(${toggle.id})"
                    >
                        Delete
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

/* Return only toggles assigned to one container. */
function getContainerToggles(containerId) {
    return allToggles.filter(
        toggle => Number(toggle.container_id) == Number(containerId)
    );
}

/* Small helper: resolves after a given number of milliseconds. */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/* Milliseconds to wait between each toggle command in a bulk action. */
const BULK_DELAY_MS = 150;

/* Run setToggleState for each toggle one at a time with a small gap.
   If state is null, each toggle's own .state is used (reset case).
   Toggles missing the required ON or OFF command are skipped silently. */
async function runSequentially(toggleList, state) {
    for (let toggle of toggleList) {
        let targetState = (state === null) ? Number(toggle.state) : state;

        /* Find full toggle data to check whether the command exists. */
        let fullToggle = allToggles.find(t => t.id == toggle.id);

        if (fullToggle) {
            let commandPresent = targetState == 1
                ? fullToggle.on_command && fullToggle.on_command.trim() !== ""
                : fullToggle.off_command && fullToggle.off_command.trim() !== "";

            if (!commandPresent) {
                continue; /* No command configured — skip this toggle. */
            }
        }

        await setToggleState(toggle.id, targetState);
        await delay(BULK_DELAY_MS);
    }
}

/* Toggle one card and persist its state through the backend. */
function toggleSwitch(id, state) {
    /* Mark as recently changed so the poller won't override it. */
    recentlyToggled[id] = Date.now();

    setToggleState(id, state ? 1 : 0)
    .catch(error => {
        console.log(error);
        alert("Error executing toggle");
    });
}

/* Save the full page state before a global Turn On/Off action. */
function savePreviousBulkStates() {
    previousBulkStates = allToggles.map(toggle => ({
        id: toggle.id,
        state: Number(toggle.state)
    }));
}

/* Save one container state before a container Turn On/Off action. */
function savePreviousContainerStates(containerId) {
    previousContainerStates[containerId] =
        getContainerToggles(containerId).map(toggle => ({
            id: toggle.id,
            state: Number(toggle.state)
        }));
}

/* Update the visible checkbox, persist state, and run the configured command. */
function setToggleState(id, state) {
    let checkbox = document.querySelector(
        `input[data-toggle-id="${id}"]`
    );

    if (checkbox) {
        checkbox.checked = state == 1;
    }

    return fetch('toggle_action.php', {
        method: 'POST',
        headers: {
            'Content-Type':
                'application/x-www-form-urlencoded'
        },
        body: `id=${id}&state=${state}`
    })
    .then(response => response.text())
    .then(data => {
        console.log(data);
        let toggle = allToggles.find(t => t.id == id);

        if (toggle) {
            toggle.state = state;
        }
    });
}

/* Turn every toggle on or off from the page-level toolbar. */
async function turnAllToggles(state) {
    savePreviousBulkStates();

    try {
        await runSequentially(allToggles, state);
    } catch (error) {
        console.log(error);
        alert("Error updating all toggles");
    }
}

/* Restore the state from before the last global Turn On/Off action. */
async function resetAllToggles() {
    if (!previousBulkStates) {
        alert("No bulk action to reset");
        return;
    }

    try {
        await runSequentially(previousBulkStates, null);
        previousBulkStates = null;
    } catch (error) {
        console.log(error);
        alert("Error resetting toggles");
    }
}

/* Turn all toggles inside one container on or off. */
async function turnContainerToggles(containerId, state) {
    let toggles = getContainerToggles(containerId);
    savePreviousContainerStates(containerId);

    try {
        await runSequentially(toggles, state);
    } catch (error) {
        console.log(error);
        alert("Error updating container toggles");
    }
}

/* Restore one container to its state before the last container bulk action. */
async function resetContainerToggles(containerId) {
    if (!previousContainerStates[containerId]) {
        alert("No bulk action to reset in this container");
        return;
    }

    try {
        await runSequentially(previousContainerStates[containerId], null);
        delete previousContainerStates[containerId];
    } catch (error) {
        console.log(error);
        alert("Error resetting container toggles");
    }
}

/* Create a new container with the default backend name containerN. */
function createContainer() {
    let formData = new URLSearchParams();
    formData.append('action', 'create_container');

    fetch('toggle_action.php', {
        method: 'POST',
        body: formData
    })
    .then(response => response.text())
    .then(() => {
        location.reload();
    });
}

/* Persist a changed container title after the editable heading loses focus. */
function saveContainerName(id, name) {
    let formData = new URLSearchParams();
    let trimmedName = name.trim();

    formData.append('action', 'edit_container');
    formData.append('id', id);
    formData.append('name', trimmedName);

    fetch('toggle_action.php', {
        method: 'POST',
        body: formData
    })
    .then(response => response.text())
    .then(() => {
        let container = allContainers.find(c => c.id == id);
        if (container) {
            container.name = trimmedName || `container${id}`;
        }
        renderContainers();
    });
}

/* Pressing Enter while renaming a container saves by blurring the heading. */
function handleContainerNameKey(event) {
    if (event.key == 'Enter') {
        event.preventDefault();
        event.target.blur();
    }
}

/* Open the confirmation modal before deleting a whole container. */
function openDeleteContainerModal(id) {
    let container = allContainers.find(c => c.id == id);
    let toggles = getContainerToggles(id);

    document.getElementById('deleteContainerId').value = id;
    document.getElementById('deleteContainerTitle').innerText =
        "Are you sure you want to delete '" +
        (container ? container.name : 'this container') +
        "'? This will also delete " +
        toggles.length +
        " toggle" +
        (toggles.length == 1 ? "" : "s") +
        " inside it.";
    document.getElementById('deleteContainerModal').style.display =
        'block';
}

function closeDeleteContainerModal() {
    document.getElementById('deleteContainerModal').style.display =
        'none';
}

/* Delete the selected container and all of its toggles. */
function deleteContainer() {
    let formData = new URLSearchParams();

    formData.append('action', 'delete_container');
    formData.append(
        'id',
        document.getElementById('deleteContainerId').value
    );

    fetch('toggle_action.php', {
        method: 'POST',
        body: formData
    })
    .then(response => response.text())
    .then(() => {
        alert('Container Deleted');
        location.reload();
    });
}

/* Fill and show the edit modal for one existing toggle. */
function openEditModal(id) {
    let toggle = allToggles.find(t => t.id == id);
    document.getElementById('editId').value = toggle.id;
    document.getElementById('editLabel').value = toggle.label;
    document.getElementById('editOnCommand').value = toggle.on_command;
    document.getElementById('editOffCommand').value = toggle.off_command;
    //Adding new code
    document.getElementById('editStatusCommand').value = toggle.status_command || '';

    document.getElementById('editModal').style.display = 'block';
}

function closeModal() {
    document.getElementById('editModal').style.display = 'none';
}

/* Save edits to a toggle label and its ON/OFF commands. */
function saveToggle() {
    let formData = new URLSearchParams();

    formData.append('action', 'edit');
    formData.append('id', document.getElementById('editId').value);
    formData.append('label', document.getElementById('editLabel').value);
    formData.append('on_command', document.getElementById('editOnCommand').value);
    formData.append('off_command', document.getElementById('editOffCommand').value);
    //Adding new code here
    formData.append('status_command', document.getElementById('editStatusCommand').value);

    fetch('toggle_action.php', {
        method: 'POST',
        body: formData
    })
    .then(response => response.text())
    .then(() => {
        alert('Saved');
        location.reload();
    });
}

/* Open the add-toggle modal for the selected container. */
function openAddModal(containerId) {
    let container = allContainers.find(c => c.id == containerId);

    document.getElementById('newContainerId').value = containerId;
    document.getElementById('newLabel').value = '';
    document.getElementById('newOnCommand').value = '';
    document.getElementById('newOffCommand').value = '';
    document.getElementById('addModalTitle').innerText =
        `Add New Toggle - ${container ? container.name : 'container'}`;
    document.getElementById('addModal').style.display = 'block';
}

function closeAddModal() {
    document.getElementById('addModal').style.display = 'none';
}

/* Create a toggle in the container selected by openAddModal(). */
function createToggle() {
    let formData = new URLSearchParams();

    formData.append('action', 'create');
    formData.append('container_id', document.getElementById('newContainerId').value);
    formData.append('label', document.getElementById('newLabel').value);
    formData.append('on_command', document.getElementById('newOnCommand').value);
    formData.append('off_command', document.getElementById('newOffCommand').value);
    //Adding new code
    formData.append('status_command', document.getElementById('newStatusCommand').value);

    fetch('toggle_action.php', {
        method: 'POST',
        body: formData
    })
    .then(response => response.text())
    .then(() => {
        alert('Toggle Created');
        location.reload();
    });
}

/* Open the confirmation modal before deleting one toggle. */
function openDeleteModal(id) {
    let toggle = allToggles.find(t => t.id == id);

    document.getElementById('deleteId').value = toggle.id;
    document.getElementById('deleteTitle').innerText =
        "Delete '" + toggle.label + "' ?";
    document.getElementById('deleteModal').style.display = 'block';
}

function closeDeleteModal() {
    document.getElementById('deleteModal').style.display = 'none';
}

/* Delete one toggle and remove its saved state on the backend. */
function deleteToggle() {
    let formData = new URLSearchParams();

    formData.append('action', 'delete');
    formData.append('id', document.getElementById('deleteId').value);

    fetch('toggle_action.php', {
        method: 'POST',
        body: formData
    })
    .then(response => response.text())
    .then(() => {
        alert('Toggle Deleted');
        location.reload();
    });
}

/* Page-level search: hide containers whose names do not match. */
function filterContainers() {
    let searchText = document.getElementById('containerSearch')
        .value
        .toLowerCase();

    document.querySelectorAll('.toggle-container').forEach(container => {
        let name = container.getAttribute('data-container-name');
        container.style.display = name.includes(searchText)
            ? ''
            : 'none';
    });
}

/* Container-level search: hide cards inside a single container. */
function filterToggles(containerId, value) {
    let searchText = value.toLowerCase();
    let container = document.querySelector(
        `.toggle-container[data-container-id="${containerId}"]`
    );

    if (!container) {
        return;
    }

    container.querySelectorAll('.card').forEach(card => {
        let label = card.getAttribute('data-label');
        card.style.display = label.includes(searchText)
            ? ''
            : 'none';
    });
}

/* Escape dynamic text before inserting it into generated HTML. */
function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function escapeAttribute(value) {
    return escapeHtml(value);
}

/*Tracks toggles that were manually switched recently. Key = toggle id, Value = timestamp in ms. The polling will skip these for 10 seconds
to avoid overriding a just-sent command before the device has time to settle.*/
let recentlyToggled = {};
const RECENTLY_TOGGLED_GRACE_MS = 10000;

setInterval(refreshToggleStates, 5000);
refreshToggleStates(); /*refreshes toggle without delay*/

function refreshToggleStates() {
    fetch(
        'toggle_action.php?action=get_status'
    )
    .then(response => response.json())
    .then(data => {
        let now = Date.now();

        Object.keys(data).forEach(id => {

            if (recentlyToggled[id] && (now - recentlyToggled[id]) < RECENTLY_TOGGLED_GRACE_MS) {
                return;
            }

            let state = Number(data[id]);
            let checkbox = document.querySelector(`input[data-toggle-id="${id}"]`);

            if (checkbox) {
                checkbox.checked =
                    state == 1;
            }

            let toggle =
                allToggles.find(
                    t => t.id == id
                );

            if (toggle){
                toggle.state = state;
            }
        });
    })
    .catch(error => {
        console.log(
            "Status refresh failed",
            error
        );
    });
}