<!-- Generated: 2026-03-30 | Cursus v2.4.0 | Token estimate: ~450 -->

# Database Schema (SQLite v47)

## Core Tables

| Table | Key Columns | Purpose | References |
|-------|------------|---------|-----------|
| `promotions` | id, name, color, archived | Class cohorts | students, channels, travaux, projects |
| `students` | id, promo_id, email, password (bcrypt), photo_data, onboarding_done, must_change_password | Student accounts | messages, groups, depots, teacher_notes |
| `teachers` | id, email, password (bcrypt), role (admin/teacher/ta), photo_data, must_change_password | Teacher accounts | messages, rubrics, live_sessions, rex_sessions, teacher_notes |
| `channels` | id, promo_id, name, type (chat/annonce), is_private, archived, category, group_id | Chat channels | messages, channel_documents, teacher_channels (deprecated) |
| `groups` | id, promo_id, name | Student groups | group_members, kanban_cards |
| `group_members` | group_id, student_id | Group membership | (pivot) |

## Assignment Tables

| Table | Key Columns | Purpose | References |
|-------|------------|---------|-----------|
| `travaux` | id, promo_id, title, type (livrable/soutenance/cctl/etude_de_cas/memoire/autre), deadline, published, channel_id, group_id, requires_submission, room, aavs | Assignments + milestones | depots, rubrics, ressources, kanban_cards, project_travaux |
| `depots` | id, travail_id, student_id, file_path, file_name, note (grade), feedback, link_url, deploy_url, submitted_at | Student submissions | rubric_scores |
| `travail_group_members` | travail_id, student_id, group_id | Assignment group access | (pivot) |
| `ressources` | id, travail_id, type (file/link), name, path_or_url, category (Moodle/Github/LinkedIn/Site Web/Autre) | Assignment resources | |
| `rubrics` | id, travail_id, title | Grading rubrics | rubric_criteria, rubric_scores |
| `rubric_criteria` | id, rubric_id, label, max_pts, weight, position | Rubric evaluation items | rubric_scores |
| `rubric_scores` | id, depot_id, criterion_id, points | Score per criterion | |
| `kanban_cards` | id, travail_id, group_id, title, description, status (todo/doing/blocked/done), position | Task tracking | |

## Document & File Tables

| Table | Key Columns | Purpose | References |
|-------|------------|---------|-----------|
| `channel_documents` | id, promo_id, channel_id, project, category, type (file/link), name, path_or_url, description, file_size, travail_id | Shared documents | project_documents |
| `project_documents` | project_id, document_id | Doc-project link | (pivot) |

## Messaging Tables

| Table | Key Columns | Purpose | References |
|-------|------------|---------|-----------|
| `messages` | id, channel_id, dm_student_id, author_id (±id), author_name, author_type, content, created_at, edited (flag), deleted_at, pinned, reactions (JSON), reply_to_id, reply_to_author, reply_to_preview | Chat messages + DM | reports |
| `reports` | id, message_id, reporter_id, reporter_name, reason (spam/harassment/inappropriate/off_topic/other), status (pending/reviewed/dismissed), resolved_at | Flagged messages | |
| `scheduled_messages` | id, channel_id, author_name, author_type, content, send_at, sent (flag) | Timed announcements | |

## Admin & Monitoring Tables

| Table | Key Columns | Purpose | References |
|-------|------------|---------|-----------|
| `active_sessions` | id, user_id, user_name, user_type, token_hash, ip, user_agent, created_at, last_seen | Logged-in sessions | |
| `login_attempts` | id, email, success, ip, user_agent, created_at | Auth audit trail | |
| `audit_log` | id, actor_id, actor_name, actor_type, action, target, details, ip, created_at | Admin action log | |
| `app_config` | key (TEXT PK), value | Global settings (read_only mode) | |
| `error_reports` | id, user_id, user_name, user_type, page, message, stack, user_agent, app_version, created_at | Frontend error logs | |
| `page_visits` | id, user_id, user_name, user_type, path, created_at | Usage analytics (DAU/WAU/MAU) | |
| `feedback` | id, user_id, user_name, user_type, type (bug/improvement/question), title, description, status (open/in_progress/resolved/wontfix), admin_reply, created_at | User feedback | |

## Teacher Tools Tables

| Table | Key Columns | Purpose | References |
|-------|------------|---------|-----------|
| `teacher_notes` | id, teacher_id, student_id, promo_id, content, tag (progression/objectif/observation/alerte/autre), category, created_at, updated_at | Private student notes | |
| `teacher_reminders` | id, promo_tag, date, title, description, bloc, done (flag) | Scheduling reminders | |
| `teacher_projects` | teacher_id, project_id, can_grade, assigned_at | Teacher-project assignment | |
| `teacher_promos` | teacher_id, promo_id | Teacher-promo access | |

## Interactive Sessions Tables

### Live Quiz
| Table | Key Columns | Purpose |
|-------|------------|---------|
| `live_sessions` | id, teacher_id, promo_id, title, join_code (UNIQUE), status (waiting/active/ended), created_at, ended_at | Live quiz sessions |
| `live_activities` | id, session_id, type (qcm/sondage/nuage), title, options (JSON), multi (flag), max_words, timer_seconds, correct_answers (JSON), position, status (pending/live/closed), started_at, closed_at | Quiz questions |
| `live_responses` | id, activity_id, student_id, answer, created_at (UNIQUE per activity+student) | Student answers |
| `live_scores` | id, session_id, activity_id, student_id, student_name, points, answer_time_ms, is_correct (flag) | Scoring + leaderboard |

### REX (Feedback)
| Table | Key Columns | Purpose |
|-------|------------|---------|
| `rex_sessions` | id, teacher_id, promo_id, title, join_code (UNIQUE), status (waiting/active/ended), is_async (flag), open_until, created_at, ended_at | Feedback collection |
| `rex_activities` | id, session_id, type (sondage_libre/nuage/echelle/question_ouverte), title, max_words, max_rating, position, status (pending/live/closed), started_at, closed_at | Feedback questions |
| `rex_responses` | id, activity_id, student_id, answer, pinned (flag), created_at (UNIQUE) | Anonymous responses |

## Digital Signatures
| Table | Key Columns | Purpose |
|-------|------------|---------|
| `signature_requests` | id, message_id, dm_student_id, file_url, file_name, file_hash (SHA256), status (pending/signed/rejected), rejection_reason, signed_file_url, signer_id, signer_name, signer_ip, signed_at, created_by, created_ip, created_at | Signature workflows |

## Projects (v42+)
| Table | Key Columns | Purpose | References |
|-------|------------|---------|-----------|
| `projects` | id, promo_id, name, description, channel_id, deadline, created_by, created_at | Organizational unit | project_travaux, project_documents, teacher_projects |
| `project_travaux` | project_id, travail_id | Assignment-project link | (pivot) |
| `project_documents` | project_id, document_id | Document-project link | (pivot) |

## Key Relationships (ER Diagram)

```
promotions
  ├─→ students
  ├─→ teachers (via teacher_promos)
  ├─→ channels
  ├─→ travaux
  ├─→ groups
  ├─→ projects
  ├─→ live_sessions
  └─→ rex_sessions

students
  ├─→ group_members → groups
  ├─→ messages (as dm_student_id)
  ├─→ depots → travaux
  ├─→ teacher_notes
  ├─→ live_responses → live_activities
  └─→ rex_responses → rex_activities

teachers
  ├─→ messages (author)
  ├─→ teacher_projects → projects
  ├─→ teacher_notes
  ├─→ teacher_reminders
  ├─→ live_sessions
  └─→ rex_sessions

travaux
  ├─→ depots → rubric_scores
  ├─→ rubrics → rubric_criteria
  ├─→ ressources
  ├─→ kanban_cards → groups
  ├─→ project_travaux → projects
  └─→ channel_documents

channels
  ├─→ messages
  ├─→ channel_documents
  └─→ scheduled_messages
```

## Indexes (25+ for performance)

| Index | Columns | Use Case |
|-------|---------|----------|
| idx_audit_created | audit_log(created_at) | Timeline queries |
| idx_audit_action | audit_log(action) | Filter by action |
| idx_messages_channel | messages(channel_id, created_at) | Load channel history |
| idx_messages_dm | messages(dm_student_id, created_at) | Load DM history |
| idx_messages_author_id | messages(author_id) | Find user's messages |
| idx_messages_deleted | messages(deleted_at) | Soft delete recovery |
| idx_channels_promo | channels(promo_id) | List promo channels |
| idx_visits_created | page_visits(created_at) | Analytics over time |
| idx_visits_user | page_visits(user_id) | User engagement |
| idx_sessions_user | active_sessions(user_id) | Multi-device tracking |
| idx_login_email | login_attempts(email) | Brute-force detection |
| idx_login_created | login_attempts(created_at) | Time-based queries |
| idx_travelers_promo | travaux(promo_id) | List assignments |
| idx_depots_student | depots(student_id) | Get student submissions |
| idx_depots_travail | depots(travail_id) | Get submissions per task |
| idx_doc_promo | channel_documents(promo_id) | Filter by promo |
| idx_doc_promo_project | channel_documents(promo_id, project) | Project docs |
| idx_teacher_notes_student | teacher_notes(student_id) | Get notes per student |

## Migrations (v0 → v47)

| Version | Feature Added |
|---------|---------------|
| v1 | Channel types, message feedback, assignment group |
| v5 | Private channels, student passwords |
| v12 | Teachers table with roles (teacher/ta) |
| v16 | Bcrypt password hashing + must_change_password |
| v19 | Reports, scheduled messages, sessions, app_config |
| v23 | Live quiz sessions + activities + responses |
| v25 | Kahoot-style scoring (live_scores table) |
| v26 | REX (anonymous feedback) sessions |
| v31 | Teacher notes per student |
| v37 | Digital signature requests |
| v42 | Projects + admin role + teacher_promos |
| v43 | Data migration: travaux → projects |
| v44 | Error reports (monitoring) |
| v45 | Student onboarding flag |
| v47 | Channel archiving |

## Encryption Status

- **Passwords**: bcrypt SHA-256 (v16+)
- **Tokens**: JWT signed with APP_JWT_SECRET
- **DMs**: AES-256-GCM groundwork (future v48+)
- **Files**: No encryption (access via JWT bearer token)
