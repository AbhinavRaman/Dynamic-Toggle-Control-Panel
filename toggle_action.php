<?php

/* File paths used by this small JSON-backed control panel. */
$togglesFile = "toggles.json";
$containersFile = "containers.json";
$stateFile = "toggle_state.json";

/* Create missing data files so the page can start from an empty project. */
if (!file_exists($togglesFile)) {
    file_put_contents($togglesFile, "[]");
}

if (!file_exists($containersFile)) {
    file_put_contents(
        $containersFile,
        json_encode(
            [
                [
                    "id" => 1,
                    "name" => "container1"
                ]
            ],
            JSON_PRETTY_PRINT
        )
    );
}

if (!file_exists($stateFile)) {
    file_put_contents($stateFile, "{}");
}

/* Load containers, toggle definitions, and saved ON/OFF states. */
$togglesData = json_decode(file_get_contents($togglesFile), true);
$containersData = json_decode(file_get_contents($containersFile), true);
$states = json_decode(file_get_contents($stateFile), true);

if (!is_array($togglesData)) {
    $togglesData = [];
}

if (!is_array($containersData) || empty($containersData)) {
    $containersData = [
        [
            "id" => 1,
            "name" => "container1"
        ]
    ];
}

if (!is_array($states)) {
    $states = [];
}

/* Guarantee that older projects always have the default container. */
$containerIds = array_column($containersData, "id");
if (!in_array(1, $containerIds)) {
    array_unshift(
        $containersData,
        [
            "id" => 1,
            "name" => "container1"
        ]
    );
}

/* Migrate older toggles by placing them inside container1. */
$togglesChanged = false;
foreach ($togglesData as &$toggle) {
    if (!isset($toggle["container_id"])) {
        $toggle["container_id"] = 1;
        $togglesChanged = true;
    }
}
unset($toggle);

if ($togglesChanged) {
    file_put_contents(
        $togglesFile,
        json_encode($togglesData, JSON_PRETTY_PRINT)
    );
}

/* Build an ID lookup so toggle actions can validate requests quickly. */
$toggles = [];
foreach ($togglesData as $toggle) {
    $toggles[$toggle["id"]] = $toggle;
}

/* Save arrays back to JSON with readable formatting. */
function saveJson($file, $data) {
    file_put_contents(
        $file,
        json_encode($data, JSON_PRETTY_PRINT)
    );
}

/* API: load all containers and toggles for the frontend renderer. */
if (isset($_GET["action"]) && $_GET["action"] == "load") {
    $responseToggles = [];

    foreach ($toggles as $id => $toggle) {
        $responseToggles[] = [
            "id" => $id,
            "container_id" => isset($toggle["container_id"])
                ? (int)$toggle["container_id"]
                : 1,
            "label" => $toggle["label"],
            "on_command" => $toggle["on_command"],
            "off_command" => $toggle["off_command"],
            //Adding new code
            "status_command" => isset($toggle["status_command"]) ? $toggle["status_command"] : "",

            "state" => isset($states[$id])
                ? (int)$states[$id]
                : 0
        ];
    }

    header("Content-Type: application/json");
    echo json_encode([
        "containers" => $containersData,
        "toggles" => $responseToggles
    ]);
    exit;
}

/* API: create a new named container using containerN as its default name. */
if (
    isset($_POST["action"]) &&
    $_POST["action"] == "create_container"
) {
    $newId = 1;
    if (!empty($containersData)) {
        $ids = array_column($containersData, "id");
        $newId = max($ids) + 1;
    }

    $containersData[] = [
        "id" => $newId,
        "name" => "container" . $newId
    ];

    saveJson($containersFile, $containersData);
    echo "Created";
    exit;
}

/* API: rename an existing container. Empty names fall back to containerN. */
if (
    isset($_POST["action"]) &&
    $_POST["action"] == "edit_container"
) {
    $id = (int)$_POST["id"];
    $name = trim($_POST["name"]);

    if ($name == "") {
        $name = "container" . $id;
    }

    foreach ($containersData as &$container) {
        if ((int)$container["id"] == $id) {
            $container["name"] = $name;
            break;
        }
    }
    unset($container);

    saveJson($containersFile, $containersData);
    echo "Updated";
    exit;
}

/* API: delete a container, all toggles inside it, and their saved states. */
if (
    isset($_POST["action"]) &&
    $_POST["action"] == "delete_container"
) {
    $id = (int)$_POST["id"];

    $containersData = array_values(
        array_filter(
            $containersData,
            function($container) use ($id) {
                return (int)$container["id"] != $id;
            }
        )
    );

    $deletedToggleIds = [];
    $togglesData = array_values(
        array_filter(
            $togglesData,
            function($toggle) use ($id, &$deletedToggleIds) {
                if ((int)$toggle["container_id"] == $id) {
                    $deletedToggleIds[] = (int)$toggle["id"];
                    return false;
                }

                return true;
            }
        )
    );

    foreach ($deletedToggleIds as $toggleId) {
        unset($states[$toggleId]);
    }

    saveJson($containersFile, $containersData);
    saveJson($togglesFile, $togglesData);
    saveJson($stateFile, $states);

    echo "Deleted";
    exit;
}

/* API: create a toggle inside a specific container. */
if (
    isset($_POST["action"]) &&
    $_POST["action"] == "create"
) {
    $newId = 1;
    if (!empty($togglesData)) {
        $ids = array_column($togglesData, "id");
        $newId = max($ids) + 1;
    }

    $containerId = isset($_POST["container_id"])
        ? (int)$_POST["container_id"]
        : 1;

    if (!in_array($containerId, array_column($containersData, "id"))) {
        $containerId = 1;
    }

    $togglesData[] = [
        "id" => $newId,
        "container_id" => $containerId,
        "label" => $_POST["label"],
        "on_command" => $_POST["on_command"],
        "off_command" => $_POST["off_command"],
        //Adding new code
        "status_command" => $_POST["status_command"]

    ];

    saveJson($togglesFile, $togglesData);
    echo "Created";
    exit;
}

/* API: edit a toggle's label and ON/OFF shell commands. */
if (
    isset($_POST["action"]) &&
    $_POST["action"] == "edit"
) {
    $id = (int)$_POST["id"];

    foreach ($togglesData as &$toggle) {
        if ((int)$toggle["id"] == $id) {
            $toggle["label"] = $_POST["label"];
            $toggle["on_command"] = $_POST["on_command"];
            $toggle["off_command"] = $_POST["off_command"];
            //Adding new code
            $toggle["status_command"] = $_POST["status_command"];

            break;
        }
    }
    unset($toggle);

    saveJson($togglesFile, $togglesData);
    echo "Updated";
    exit;
}

/* API: delete one toggle and remove its saved ON/OFF state. */
if (
    isset($_POST["action"]) &&
    $_POST["action"] == "delete"
) {
    $id = (int)$_POST["id"];

    $togglesData = array_values(
        array_filter(
            $togglesData,
            function($toggle) use ($id) {
                return (int)$toggle["id"] != $id;
            }
        )
    );

    unset($states[$id]);

    saveJson($togglesFile, $togglesData);
    saveJson($stateFile, $states);

    echo "Deleted";
    exit;
}

/*API: API to read device status, Adding new code*/
if (
    isset($_GET["action"]) && $_GET["action"] == "get_status"
){
    $result = [];

    foreach ($togglesData as $toggle) {
        if(
            !isset($toggle["status_command"]) || trim($toggle["status_command"]) == ""
        ) {
            continue;
        }

        $output = trim(
            shell_exec(
               $toggle["status_command"] . " 2>&1"
            )
        );

        /*$result[$toggle["id"]] =
            $output == "1" ? 1 : 0; old code*/

        /*Only updates the state when we get a clean 0 and 1 back. An empty string or error message means the command failed (example,
           device unreachable) then skip that toggle so the UI is not incorrectly forced to OFF*/
        if ($output === "1") {
            $result[$toggle["id"]] = 1;
        }else if ($output === "0") {
            $result[$toggle["id"]] = 0;
        }
    }

    header("Content-Type: application/json");
    echo json_encode($result);
    exit;
}


/* Default POST behavior: update one toggle state and run its command. */
$id = isset($_POST["id"])
    ? (int)$_POST["id"]
    : 0;

$state = isset($_POST["state"])
    ? (int)$_POST["state"]
    : 0;

if (!isset($toggles[$id])) {
    exit("Invalid toggle");
}

$states[$id] = $state;
saveJson($stateFile, $states);

/* Pick the command configured for the requested state. */
if ($state == 1) {
    $command = $toggles[$id]["on_command"];
}
else {
    $command = $toggles[$id]["off_command"];
}

/* Execute the command and return the output to the browser console. */
$output = shell_exec($command . " 2>&1");

echo $output ?: "Command Executed";
