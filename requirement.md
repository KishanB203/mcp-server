# Knowledge Base — Policy Module

The Knowledge Base module provides a centralized document management system that allows Admins to create, organize, and distribute internal documents across the organization. Documents are categorized into three types — Policies, Rules, and Manuals — each accessible through dedicated tabs on the listing page. The module ensures that the right documents are visible to the right people by enforcing access control based on department and position.

The module is designed for two primary user types: Admins who manage all content and Normal Users who consume it. Admins have full control over creating, editing, deleting, and assigning access to documents. Normal Users can only view, search, and download documents that have been explicitly assigned to their department and position. This separation ensures organizational content remains structured and access-controlled at all times.

# Login Screen and Role-Based Authentication

The system must provide a dedicated login screen with Email or Username and Password fields, along with a Sign In button. Required field validation must run before submission, and invalid credentials must return a clear error message.

After successful login, the system must identify the user's role (Admin or Normal User) and the user's department and position. A secure session or token must be issued and required for all protected APIs.

Role-based behavior after login must be enforced as follows:
- Admin: full create, edit, delete, category management, assignment control, and unrestricted document visibility.
- Normal User: read-only access to only those documents and categories allowed by exact department and position mapping.

If authentication fails, the user stays on the login screen with a proper error message. If a session expires or becomes invalid, the user must be redirected to login and required to authenticate again.

# Category Management

The Knowledge Base module includes three default categories: Policy, Rules, and Manual. These default categories must always be available and visible in the system.

Admins can create additional custom categories when needed. While creating a category, the Admin must provide a unique category name. Duplicate category names are not allowed and must return a clear validation error.

New custom categories must be available immediately in the category tabs on the listing page and in the category dropdown on Create Policy. Only Admins can create and manage categories.

# Policy Listing Page

The Policy Listing Page is the main entry point for the Knowledge Base module. It displays all available policies in a structured table format with columns for serial number, title, short description, creation date, and action controls. The page includes a breadcrumb navigation showing the path as Home / Knowledge Base / Policy, along with tabs at the top to switch between the Policy, Rules, and Manual categories.

Users must be able to navigate from any category tab to the corresponding list screen for that category. The selected category context should be clear so users always know which document type they are viewing.

Admins can see action controls on each row, including options to edit the policy, delete the policy, and copy a shareable URL to the clipboard. Normal Users see the same listing but without any action controls — they can only view and interact with documents they are permitted to access. The Add New Policy button is visible only to Admins and is positioned at the top right of the page. Clicking it navigates the Admin to the Create Policy screen.

The list screen must include the category title, category description, and a search bar to help users quickly find relevant entries. A unit-based filter dropdown must be available to narrow results by organizational unit or department.

The listing page must support a view toggle with two options: List and Minimize. List must be selected by default when users first open the screen.

If no records are available in the selected category, the page must show an empty state as per approved design, display a clear no-data message, and provide a primary action button labeled "Create {category_name}" for Admin users.

When records are available, they must be shown in a tabular format with the following columns: Title, Description, Created Date, and Actions. Title and Created Date should support sorting to help business users organize content quickly.

# Search & Filter

The search functionality on the Policy Listing Page must support real-time searching across both the policy title and description fields. Search should be case-insensitive and support partial matching so users can find relevant documents without typing the full title.

The unit filter dropdown works in combination with the search input, allowing users to narrow results by department or unit while also applying a text search. When both filters are active, results must satisfy both conditions simultaneously. If the search or filter returns no results, an appropriate empty state message must be shown to the user. Clearing the search field or resetting the filter must restore the full listing.

# Pagination

The Policy Listing Page must support paginated data loading to handle large numbers of policy records efficiently. The pagination controls must include a dropdown for selecting the number of entries displayed per page, with options such as 10, 25, 50, and 100. Navigation buttons for moving between pages and a label showing the current range and total record count — such as Showing 1–10 of 45 records — must be clearly visible below the table. The default page size should be 10 entries per page.

# Minimize View

When users switch from List to Minimize view, the screen should present a focused reading and management layout:
- Left panel: list of available items
- Center area: document preview of the selected item
- Right panel: selected item details and available actions

Selecting an item from the left panel must immediately update both the center preview and the right-side details to keep context aligned.

# Create Policy — Step 1: Basic Information

Creating a new policy is a two-step process. Step 1 is used to upload a document and capture basic information before moving to department assignment.

When the user clicks "Upload Document", the system must open this Step 1 screen.

A clear step indicator must be shown at the top of the screen and must highlight the current step so users understand where they are in the creation flow.

A short instruction message should be displayed to guide users on what to complete in this step.

The screen should be split into two business-friendly areas:
- Left side: data input section
- Right side: document preview section

The left side must include:
- Title (required)
- Description (optional)
- Upload Document control

For document upload, users must be able to attach a file using standard upload interactions. Only supported file types are allowed (PDF, DOC, DOCX; up to 100 MB). The screen must provide clear options to remove or replace the uploaded file.

On the right side, the document preview must display the uploaded file. If no file is uploaded yet, a clear placeholder message must be shown.

The step includes three action buttons in the footer:
- Back to return to the previous screen
- Cancel to stop the process and exit to the listing page
- Continue to move to the next step after required information is completed

Required fields must be completed before continuing, and clear messages must be shown if information is missing or invalid.

# Document Upload

The document upload component must clearly communicate its current state to the user at all times. In the default state before any file is selected, the upload area should display a visual cue and a label indicating that files can be dragged and dropped or selected manually.

During upload, users should see clear progress feedback. Once a file has been successfully uploaded, the component must display the file name and a preview indicator.

If an unsupported file format is selected, the component must reject the file and show a clear error message specifying accepted formats. If a file exceeds the 100 MB size limit, upload must be blocked and the user informed of the size restriction.

# Create Policy — Step 2: Department Assignment

Step 2 allows the Admin to control who can access the policy by assigning one or more department and position combinations. The Admin selects a department from a dropdown — such as Design, Development, HR, or Management — and a position from another dropdown — such as Team Leader, Manager, Developer, or CEO. Clicking the Add button appends the selected combination as a new row in the access assignment table.

The access table displays the department name, position, and the number of users who match that department and position combination. The Admin can add as many department and position pairs as needed, allowing a single policy to be accessible to multiple teams or roles. Each row in the table can be individually removed if access needs to be revoked before saving.

The step includes Back to return to Step 1 with all entered data preserved, Cancel to discard all data and return to the listing page, and Create to submit the entire form and create the policy. On successful creation, the user is redirected to the listing page, where the new policy appears at the top. A success notification must confirm the action.

# Normal User View

Normal Users access the Knowledge Base module in a read-only capacity. The listing page appears the same as the Admin view, but without any action controls such as edit, delete, or copy URL buttons. The Add New Policy button is not visible or accessible to Normal Users.

Normal Users must be able to search, filter, view, preview, and download documents they are permitted to access. The user interface must not expose any create, edit, or delete controls regardless of how the user navigates or accesses the application.

Normal Users must only see categories that satisfy both conditions: (1) the category contains at least one policy assigned to the user's exact department and position, and (2) the user has access to at least one document within that category. Categories with zero accessible policies for that user must not be displayed.

# Access Control Logic

Policy visibility is governed by a strict department and position-based access model. A user can only see a policy if their department and position exactly match at least one access assignment configured by the Admin during policy creation. A match on department alone or position alone is not sufficient — both conditions must be satisfied simultaneously for the user to see the document.

For example, if a policy has been assigned to the Design department with a Team Leader position, only users who belong to the Design department and hold the Team Leader position will see that policy. A user from the Design department with a Developer position or a user from the HR department with a Team Leader position will not have access. Admins bypass this logic and can always view and manage all policies regardless of their own department and position.

Access control must be enforced on the server side and must not rely solely on front-end visibility rules. All API responses must filter policy data according to the authenticated user's department, position, and role before returning results.

# Delete Policy

When an Admin clicks the delete action on a policy, the system must display a confirmation modal before proceeding with the deletion. The modal title should read Deletion Confirmation and the body message should ask the Admin to confirm whether they want to delete the resource. A warning message must clearly state that all documents attached to this policy will be permanently erased and cannot be recovered.

The modal provides two buttons — Cancel to dismiss the modal without making any changes, and Delete to confirm and permanently remove the policy along with all its associated documents from storage. Upon successful deletion, a success notification must be displayed and the listing page must refresh to reflect the removed policy.

# Notifications

The system must display clear and contextual toaster notifications for key actions, including create, edit, delete, and other important status updates so users receive immediate feedback on what happened.

# General Experience Guidelines

All user interface behavior and screen structure must align with approved design references(figma). The module should provide a smooth, consistent, and responsive experience across empty states, list views, minimized views, and action flows.
