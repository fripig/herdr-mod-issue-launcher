## ADDED Requirements

### Requirement: Docked issue panel layout

The project SHALL provide a Herdr layout named `issue-launcher` that has the same regions as Herdr's `main` layout (sidebar with spaces and agents, tab bar, active tab, right panel, status bar) and adds an `issues` block, showing the `issue-launcher` mod, as a third child of the right panel stack `panel-body` after `files` and `changes`. While that block is shown, the issue panel SHALL behave as specified for the floating window, except that it SHALL NOT draw the ✕ close button.

#### Scenario: Panel shown in the layout

- **WHEN** the `issue-launcher` layout is shown and the right panel shows its `issues` child
- **THEN** the issue panel fills the right panel and lists the active project's issues, with no ✕ button

#### Scenario: Floating window keeps its close button

- **WHEN** the panel is opened with `mod.open` as a floating window
- **THEN** its title row shows the ✕ button and clicking it closes the window

### Requirement: Issues button in the tab bar

The `issue-launcher` layout SHALL place, to the right of the tab bar and at the tab bar's height, a block showing the `issue-launcher` mod with `props: { role: "button" }`. That copy SHALL draw only an "Issues" button styled like Herdr's Files and Changes buttons, highlighted while the right panel is visible with `issues` as its active child. Clicking the highlighted button SHALL hide the right panel. Clicking it otherwise SHALL select `issues` in `panel-body` and show the right panel.

#### Scenario: Toggle the panel

- **WHEN** the person clicks Issues in each of the panel states below
- **THEN** the panel and button end in the state shown

##### Example: button clicks

| Panel before | Active child before | After click | Button after |
| ------------ | ------------------- | ----------- | ------------ |
| hidden | files | shown, active issues | highlighted |
| shown | changes | shown, active issues | highlighted |
| shown | issues | hidden | not highlighted |

### Requirement: Issues panel kept per space

The `issue-launcher` mod SHALL ensure the shared value `workspace.panels` contains `issues`, adding it after the existing entries when it is missing (treating a missing value as `files`, `changes`), and SHALL NOT remove or reorder other entries. With `issues` in that list, Herdr's tab bar restores the Issues panel for a space that last showed it.

#### Scenario: Adding issues to the panels list

- **WHEN** the mod starts in the layout
- **THEN** `workspace.panels` becomes the value below

##### Example: panels list

| workspace.panels before | after |
| ----------------------- | ----- |
| (unset) | files, changes, issues |
| files, changes | files, changes, issues |
| (empty list) | issues |
| files, changes, issues | unchanged |
