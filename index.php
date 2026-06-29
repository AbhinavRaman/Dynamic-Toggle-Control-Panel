<!DOCTYPE html>
<html>

<head>
    <title>Dynamic Toggle Control</title>
    <!-- Page styling lives in a separate file to keep this template small. -->
    <link rel="stylesheet" href="toggle_style.css">
</head>

<body>
    <h1>Control Panel</h1>

    <!-- Global controls for searching containers and running actions on every toggle. -->
    <div class="page-toolbar">
        <div class="search-container">
            <input
                type="text"
                id="containerSearch"
                class="search-input"
                placeholder="🔍 Container by Name.."
                onkeyup="filterContainers()"
            >
        </div>

        <div class="toolbar-actions">
            <button onclick="createContainer()" class="create-container-btn">
                + Create Container
            </button>

            <button onclick="turnAllToggles(1)" class="turnOnAll-btn">
                Turn On All
            </button>

            <button onclick="turnAllToggles(0)" class="turnOffAll-btn">
                Turn Off All
            </button>

            <button onclick="resetAllToggles()" class="resetAll-btn">
                Reset
            </button>
        </div>
    </div>

    <!-- JavaScript renders all saved containers and their toggle cards here. -->
    <div class="containers-wrapper" id="containersWrapper"></div>

    <!-- Modal for editing an existing toggle card. -->
    <div id="editModal" class="modal">
        <div class="modal-content">
            <h3>Edit Toggle</h3>
            <input type="hidden" id="editId">
            <input id="editLabel" placeholder="Title">
            <br><br>
            <textarea id="editOnCommand" rows="4" cols="50" placeholder="ON Command"></textarea>
            <br><br>
            <textarea id="editOffCommand" rows="4" cols="50" placeholder="OFF Command"></textarea>
            <br><br>

            <!-- "Adding new code here" -->
            <textarea id="editStatusCommand" rows="4" cols="50" placeholder="Status Command"></textarea>

            <button onclick="saveToggle()">Save</button>
            <button onclick="closeModal()">Cancel</button>
        </div>
    </div>

    <!-- Modal for creating a new toggle inside the selected container. -->
    <div id="addModal" class="modal">
        <div class="modal-content">
            <h3 id="addModalTitle">Add New Toggle</h3>
            <input type="hidden" id="newContainerId">
            <input id="newLabel" placeholder="Toggle Name">
            <br><br>
            <textarea id="newOnCommand" rows="4" cols="50" placeholder="ON Command"></textarea>
            <br><br>
            <textarea id="newOffCommand" rows="4" cols="50" placeholder="OFF Command"></textarea>
            <br><br>

            <!-- "Adding new code here" -->
            <textarea id="newStatusCommand" rows="4" cols="50" placeholder="Status Command"></textarea>

            <button onclick="createToggle()">Create</button>
            <button onclick="closeAddModal()">Cancel</button>
        </div>
    </div>

    <!-- Confirmation modal for deleting one toggle card. -->
    <div id="deleteModal" class="modal">
        <div class="modal-content">
            <h3>Delete Toggle</h3>
            <input type="hidden" id="deleteId">
            <p id="deleteTitle"></p>
            <button onclick="deleteToggle()">Yes Delete</button>
            <button onclick="closeDeleteModal()">Cancel</button>
        </div>
    </div>

    <!-- Confirmation modal for deleting a whole container and its toggles. -->
    <div id="deleteContainerModal" class="modal">
        <div class="modal-content">
            <h3>Delete Container</h3>
            <input type="hidden" id="deleteContainerId">
            <p id="deleteContainerTitle"></p>
            <button onclick="deleteContainer()">Yes Delete</button>
            <button onclick="closeDeleteContainerModal()">Cancel</button>
        </div>
    </div>

    <!-- App behavior and API calls live in a separate file. -->
    <script src="toggle_app.js"></script>
</body>

</html>
