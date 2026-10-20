-- Pejuang Yen — Demo User Seed Data
-- Login: demo@pejuangyen.com / Demo@12345
-- Scenario: user with active yearly membership, 2 paid orders, enrolled in 2 courses

-- 1. Demo user
-- Password hash is PBKDF2:100000 for "Demo@12345" (precomputed, fixed salt for reproducibility)
INSERT OR IGNORE INTO users (id, email, password_hash, name, role, status, created_at, updated_at)
VALUES (
  'user-demo-001',
  'demo@pejuangyen.com',
  'pbkdf2:100000:4a7f2c8e91b35d0fa26e1345c789f01b:873c9e2061f039fa7fde9c3c2c7689317e0ca727cbf74e159dcb4afccbab4540',
  'Budi Santoso (Demo)',
  'user',
  'active',
  '2026-03-15T08:00:00.000Z',
  '2026-03-15T08:00:00.000Z'
);

-- 2. Affiliate account for demo user
INSERT OR IGNORE INTO affiliate_accounts (id, user_id, affiliate_code, status, default_commission_rate, created_at, updated_at)
VALUES (
  'affiliate-demo-001',
  'user-demo-001',
  'DEMO2026',
  'active',
  10,
  '2026-03-15T08:00:00.000Z',
  '2026-03-15T08:00:00.000Z'
);

-- 3. Order 1: Paid course (Prompt Engineering Masterclass)
INSERT OR IGNORE INTO orders (id, user_id, order_number, order_type, product_id, product_name, amount, currency, status, created_at, updated_at, paid_at)
VALUES (
  'order-demo-001',
  'user-demo-001',
  'ORD-2026-0001',
  'course',
  'course-002',
  'Prompt Engineering Masterclass',
  299000,
  'IDR',
  'paid',
  '2026-03-16T10:00:00.000Z',
  '2026-03-16T10:05:00.000Z',
  '2026-03-16T10:05:00.000Z'
);

-- 4. Order 2: Yearly membership
INSERT OR IGNORE INTO orders (id, user_id, order_number, order_type, product_id, product_name, amount, currency, status, created_at, updated_at, paid_at)
VALUES (
  'order-demo-002',
  'user-demo-001',
  'ORD-2026-0002',
  'membership',
  'plan-yearly',
  'Membership Tahunan',
  799000,
  'IDR',
  'paid',
  '2026-03-16T10:10:00.000Z',
  '2026-03-16T10:15:00.000Z',
  '2026-03-16T10:15:00.000Z'
);

-- 5. Payment record for order-demo-001
INSERT OR IGNORE INTO payments (id, order_id, provider, provider_transaction_id, amount, currency, status, created_at, updated_at, paid_at)
VALUES (
  'payment-demo-001',
  'order-demo-001',
  'mayar',
  'mayar-txn-demo-001',
  299000,
  'IDR',
  'paid',
  '2026-03-16T10:05:00.000Z',
  '2026-03-16T10:05:00.000Z',
  '2026-03-16T10:05:00.000Z'
);

-- 6. Payment record for order-demo-002
INSERT OR IGNORE INTO payments (id, order_id, provider, provider_transaction_id, amount, currency, status, created_at, updated_at, paid_at)
VALUES (
  'payment-demo-002',
  'order-demo-002',
  'mayar',
  'mayar-txn-demo-002',
  799000,
  'IDR',
  'paid',
  '2026-03-16T10:15:00.000Z',
  '2026-03-16T10:15:00.000Z',
  '2026-03-16T10:15:00.000Z'
);

-- 7. Active yearly membership (expires 2027-05-26)
-- source_order_id references order-demo-002
INSERT OR IGNORE INTO memberships (id, user_id, plan_id, status, starts_at, expires_at, source_order_id, created_at, updated_at)
VALUES (
  'membership-demo-001',
  'user-demo-001',
  'plan-yearly',
  'active',
  '2026-03-16T10:15:00.000Z',
  '2027-03-16T10:15:00.000Z',
  'order-demo-002',
  '2026-03-16T10:15:00.000Z',
  '2026-03-16T10:15:00.000Z'
);

-- 8. User access for course-002 (lifetime access from order)
-- access_type='lifetime', resource_type='course', source_type='order'
INSERT OR IGNORE INTO user_access (id, user_id, access_type, resource_type, resource_id, source_type, source_id, status, starts_at, expires_at, created_at, updated_at)
VALUES (
  'access-demo-001',
  'user-demo-001',
  'lifetime',
  'course',
  'course-002',
  'order',
  'order-demo-001',
  'active',
  '2026-03-16T10:05:00.000Z',
  NULL,
  '2026-03-16T10:05:00.000Z',
  '2026-03-16T10:05:00.000Z'
);

-- 9. Enrollment: course-001 (free, self-enrolled)
INSERT OR IGNORE INTO enrollments (id, user_id, course_id, progress_percent, status, enrolled_at, updated_at)
VALUES (
  'enrollment-demo-001',
  'user-demo-001',
  'course-001',
  100,
  'active',
  '2026-03-15T09:00:00.000Z',
  '2026-04-01T14:00:00.000Z'
);

-- 10. Enrollment: course-002 (paid)
INSERT OR IGNORE INTO enrollments (id, user_id, course_id, source_access_id, progress_percent, status, enrolled_at, updated_at)
VALUES (
  'enrollment-demo-002',
  'user-demo-001',
  'course-002',
  'access-demo-001',
  40,
  'active',
  '2026-03-16T10:05:00.000Z',
  '2026-04-10T11:00:00.000Z'
);

-- 11. Lesson progress for course-001 (all 3 lessons completed)
INSERT OR IGNORE INTO lesson_progress (id, enrollment_id, lesson_id, status, completed_at, updated_at)
VALUES
  ('lp-demo-001', 'enrollment-demo-001', 'lesson-001', 'completed', '2026-03-15T09:20:00.000Z', '2026-03-15T09:20:00.000Z'),
  ('lp-demo-002', 'enrollment-demo-001', 'lesson-002', 'completed', '2026-03-15T09:45:00.000Z', '2026-03-15T09:45:00.000Z'),
  ('lp-demo-003', 'enrollment-demo-001', 'lesson-003', 'completed', '2026-03-15T10:10:00.000Z', '2026-03-15T10:10:00.000Z');

-- 12. Lesson progress for course-002 (2 of 2 lessons started/completed)
INSERT OR IGNORE INTO lesson_progress (id, enrollment_id, lesson_id, status, completed_at, updated_at)
VALUES
  ('lp-demo-004', 'enrollment-demo-002', 'lesson-004', 'completed', '2026-03-17T10:00:00.000Z', '2026-03-17T10:00:00.000Z'),
  ('lp-demo-005', 'enrollment-demo-002', 'lesson-005', 'not_started', NULL, '2026-03-17T10:00:00.000Z');
