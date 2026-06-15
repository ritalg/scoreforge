import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, '../data/scoreforge.db');
const db = new Database(dbPath);

const insert = db.prepare(`
  INSERT INTO questions (question_text, question_type, choice_a, choice_b, choice_c, choice_d,
    correct_answer, explanation, topic_key, difficulty, module, status)
  VALUES (?, 'multiple_choice', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved')
`);

const questions = [
  // ALGEBRA
  [
    'If 3x + 7 = 22, what is the value of x?',
    '3', '5', '7', '9', 'B',
    'Subtract 7 from both sides: 3x = 15, then divide by 3: x = 5.',
    'algebra', 'easy', 'm1',
  ],
  [
    'Which of the following is equivalent to 2(x + 3) - 4?',
    '2x + 2', '2x + 6', '2x - 2', '2x + 10', 'A',
    'Distribute: 2x + 6 - 4 = 2x + 2.',
    'algebra', 'easy', 'm1',
  ],
  [
    'A line passes through (0, 4) and (2, 10). What is the slope?',
    '2', '3', '4', '6', 'B',
    'Slope = (10 - 4) / (2 - 0) = 6 / 2 = 3.',
    'algebra', 'easy', 'm1',
  ],
  [
    'If f(x) = 3x² - 2x + 1, what is f(2)?',
    '7', '9', '11', '13', 'B',
    'f(2) = 3(4) - 2(2) + 1 = 12 - 4 + 1 = 9.',
    'algebra', 'medium', 'm1',
  ],
  [
    'Solve: |2x - 6| = 10',
    'x = 8 only', 'x = -2 only', 'x = 8 or x = -2', 'x = 2 or x = -8', 'C',
    '2x - 6 = 10 gives x = 8; 2x - 6 = -10 gives x = -2.',
    'algebra', 'medium', 'm2_hard',
  ],
  [
    'The system y = 2x + 1 and y = -x + 7 has solution (x, y). What is x + y?',
    '4', '5', '7', '9', 'C',
    'Set equal: 2x + 1 = -x + 7, so 3x = 6, x = 2. Then y = 5. x + y = 7.',
    'algebra', 'medium', 'm1',
  ],
  [
    'If 4^(x+1) = 64, what is x?',
    '1', '2', '3', '4', 'B',
    '64 = 4^3, so x + 1 = 3, therefore x = 2.',
    'algebra', 'hard', 'm2_hard',
  ],
  [
    'What is the x-intercept of the line 3x - 2y = 12?',
    '(4, 0)', '(6, 0)', '(0, -6)', '(2, 0)', 'A',
    'Set y = 0: 3x = 12, x = 4. The x-intercept is (4, 0).',
    'algebra', 'easy', 'm1',
  ],

  // ADVANCED MATH
  [
    'Which expression is equivalent to (x² - 9) / (x - 3)?',
    'x - 3', 'x + 3', 'x² + 3', 'x² - 3', 'B',
    'Factor numerator: (x - 3)(x + 3) / (x - 3) = x + 3 for x ≠ 3.',
    'adv_math', 'medium', 'm1',
  ],
  [
    'The function g(x) = x² - 6x + 9 can be written as:',
    '(x - 3)²', '(x + 3)²', '(x - 3)(x + 3)', '(x - 9)²', 'A',
    'x² - 6x + 9 is a perfect square trinomial equal to (x - 3)².',
    'adv_math', 'medium', 'm1',
  ],
  [
    'If h(x) = 2x³ - x, what is h(-1)?',
    '-1', '1', '-3', '3', 'A',
    'h(-1) = 2(-1)³ - (-1) = -2 + 1 = -1.',
    'adv_math', 'medium', 'm2_hard',
  ],
  [
    'The graph of y = (x - 2)²(x + 1) crosses the x-axis at how many distinct points?',
    '1', '2', '3', '4', 'B',
    'Roots are x = 2 (tangent, touches but does not cross) and x = -1 (crosses). There are 2 distinct x-intercepts.',
    'adv_math', 'hard', 'm2_hard',
  ],
  [
    'Which of the following is a solution to 2x² - 5x - 3 = 0?',
    'x = -1/2', 'x = 3', 'x = -3', 'x = 1/2', 'B',
    'Factor: (2x + 1)(x - 3) = 0. Solutions are x = -1/2 and x = 3.',
    'adv_math', 'medium', 'm2_hard',
  ],

  // PROBLEM SOLVING & DATA ANALYSIS
  [
    'A store marks up items by 40%. If an item costs $50, what is the selling price?',
    '$60', '$70', '$75', '$90', 'B',
    '40% of 50 = 20. Selling price = 50 + 20 = $70.',
    'psda', 'easy', 'm1',
  ],
  [
    'In a class of 30 students, 60% passed a test. How many students failed?',
    '12', '15', '18', '20', 'A',
    '60% passed means 18 passed. 30 - 18 = 12 failed.',
    'psda', 'easy', 'm1',
  ],
  [
    'A dataset has values 4, 7, 7, 9, 13. What is the median?',
    '4', '7', '8', '9', 'B',
    'Ordered: 4, 7, 7, 9, 13. The middle (3rd) value is 7.',
    'psda', 'easy', 'm1',
  ],
  [
    'A car travels 240 miles in 4 hours. At the same rate, how far does it travel in 7 hours?',
    '360', '380', '420', '480', 'C',
    'Rate = 60 mph. Distance = 60 × 7 = 420 miles.',
    'psda', 'medium', 'm1',
  ],
  [
    'A survey shows 35% of 200 people prefer brand A. How many prefer brand A?',
    '35', '60', '70', '75', 'C',
    '35% × 200 = 70 people prefer brand A.',
    'psda', 'easy', 'm1',
  ],
  [
    'The mean of five numbers is 12. If four of the numbers are 8, 10, 14, and 16, what is the fifth number?',
    '10', '12', '14', '16', 'B',
    'Total sum = 12 × 5 = 60. Sum of four = 8 + 10 + 14 + 16 = 48. Fifth = 60 - 48 = 12.',
    'psda', 'medium', 'm1',
  ],

  // GEOMETRY
  [
    'A rectangle has length 8 and width 5. What is the area?',
    '26', '30', '40', '45', 'C',
    'Area = length × width = 8 × 5 = 40.',
    'geometry', 'easy', 'm1',
  ],
  [
    'A circle has radius 6. What is the circumference? (Use π ≈ 3.14)',
    '18.84', '37.68', '56.52', '113.04', 'B',
    'C = 2πr = 2 × 3.14 × 6 = 37.68.',
    'geometry', 'easy', 'm1',
  ],
  [
    'In a right triangle, the legs are 5 and 12. What is the hypotenuse?',
    '13', '15', '17', '√119', 'A',
    'By the Pythagorean theorem: √(5² + 12²) = √(25 + 144) = √169 = 13.',
    'geometry', 'medium', 'm1',
  ],
  [
    'Two parallel lines are cut by a transversal. If one angle is 65°, what is the co-interior (same-side interior) angle?',
    '65°', '115°', '125°', '90°', 'B',
    'Co-interior angles are supplementary and sum to 180°. 180 - 65 = 115°.',
    'geometry', 'medium', 'm1',
  ],
  [
    'The volume of a cylinder with radius 3 and height 5 is: (Use π ≈ 3.14)',
    '47.1', '94.2', '141.3', '188.4', 'C',
    'V = πr²h = 3.14 × 9 × 5 = 141.3.',
    'geometry', 'medium', 'm2_hard',
  ],

  // INFORMATION & IDEAS
  [
    'A passage describes how deforestation affects local rainfall patterns. The primary purpose is most likely to:',
    'Entertain readers with stories of forest animals',
    'Explain a cause-and-effect relationship in environmental science',
    'Argue that governments should ban logging completely',
    'Compare two different ecosystems',
    'B',
    'The passage explains how deforestation (cause) leads to reduced rainfall (effect), which is a cause-and-effect structure.',
    'info_ideas', 'easy', 'm1',
  ],
  [
    'A researcher claims that coffee consumption improves memory. To most effectively support this claim, the researcher should present:',
    'Anecdotal accounts from coffee drinkers',
    'A controlled study showing memory improvement in coffee drinkers vs. non-drinkers',
    'Statistics about global coffee consumption',
    'Historical data on coffee production',
    'B',
    'A controlled study with a comparison group provides the strongest scientific evidence for a causal claim.',
    'info_ideas', 'medium', 'm2_hard',
  ],
  [
    'Which choice best describes the structure of a passage that begins with a problem, discusses three proposed solutions, and evaluates their effectiveness?',
    'Chronological narrative',
    'Problem-solution analysis',
    'Compare and contrast',
    'Definition and example',
    'B',
    'The passage presents a problem, offers solutions, and evaluates them — a classic problem-solution structure.',
    'info_ideas', 'medium', 'm1',
  ],

  // CRAFT & STRUCTURE
  [
    'In context, the word "luminous" most nearly means:',
    'Heavy', 'Glowing', 'Silent', 'Ancient', 'B',
    'Luminous comes from "lumen" (light) and means emitting or reflecting bright light.',
    'craft_structure', 'easy', 'm1',
  ],
  [
    'An author uses the phrase "the city breathed" to describe morning rush hour. This is an example of:',
    'Simile', 'Alliteration', 'Personification', 'Hyperbole', 'C',
    'Attributing the human action of breathing to a city is personification.',
    'craft_structure', 'easy', 'm1',
  ],
  [
    'A passage shifts from describing a character\'s childhood happiness to adult regret. This shift in tone is best described as moving from:',
    'Formal to informal',
    'Nostalgic to melancholic',
    'Optimistic to humorous',
    'Analytical to descriptive',
    'B',
    'Nostalgic captures warmth of remembered childhood; melancholic captures the sadness of adult regret.',
    'craft_structure', 'medium', 'm1',
  ],

  // EXPRESSION OF IDEAS
  [
    'Which revision most effectively combines these sentences? "Maria studied hard. She passed the exam."',
    'Maria studied hard, and she passed the exam.',
    'Maria studied hard; consequently, she passed the exam.',
    'Maria studied hard, she passed the exam.',
    'Maria studied hard because she passed the exam.',
    'B',
    'Using "consequently" correctly shows the cause-and-effect relationship and properly joins two independent clauses.',
    'expression', 'medium', 'm1',
  ],
  [
    'A student wants to add a detail supporting the idea that urban gardens improve mental health. Which addition is most relevant?',
    'Urban gardens require significant watering.',
    'A 2022 study found that 30 minutes of gardening reduced anxiety scores by 20%.',
    'Some cities have banned pesticides in public spaces.',
    'Tomatoes are the most popular vegetable to grow.',
    'B',
    'The study directly supports the claim about mental health improvement with specific, measurable data.',
    'expression', 'medium', 'm1',
  ],
  [
    'Which transition word best connects these sentences: "The team practiced daily. ___, they won the championship."',
    'However', 'Nevertheless', 'Consequently', 'Although', 'C',
    '"Consequently" correctly signals that winning was the result of daily practice.',
    'expression', 'easy', 'm1',
  ],

  // STANDARD ENGLISH CONVENTIONS
  [
    'Which choice correctly punctuates the sentence? "The experiment which lasted three days produced unexpected results."',
    'The experiment which lasted three days, produced unexpected results.',
    'The experiment, which lasted three days, produced unexpected results.',
    'The experiment which lasted three days produced unexpected results.',
    'The experiment; which lasted three days, produced unexpected results.',
    'B',
    'A non-restrictive relative clause ("which lasted three days") must be set off by commas on both sides.',
    'conventions', 'medium', 'm1',
  ],
  [
    'Select the grammatically correct sentence:',
    'Each of the students have submitted their essay.',
    'Each of the students has submitted their essay.',
    'Each of the students have submitted his essay.',
    'Each of the students submits their essays.',
    'B',
    '"Each" is singular and takes the singular verb "has." Modern usage accepts "their" as a gender-neutral pronoun.',
    'conventions', 'medium', 'm2_hard',
  ],
  [
    'Which sentence correctly uses a semicolon?',
    'I enjoy hiking; and swimming.',
    'She finished the report; however, she forgot to email it.',
    'The dog barked; the cat.',
    'He was tired; to go home.',
    'B',
    'A semicolon can join two independent clauses, especially when followed by a conjunctive adverb like "however."',
    'conventions', 'medium', 'm1',
  ],
  [
    'Which of the following sentences contains a dangling modifier?',
    'Running quickly, she caught the bus.',
    'After finishing the report, the manager reviewed it.',
    'Walking through the park, the flowers were beautiful.',
    'Exhausted from the hike, he fell asleep immediately.',
    'C',
    'In option C, "Walking through the park" modifies nothing — the flowers cannot walk. The subject of the modifier (a person) is missing.',
    'conventions', 'hard', 'm2_hard',
  ],
];

const insertAll = db.transaction(() => {
  for (const q of questions) {
    insert.run(...q);
  }
});

insertAll();

const newCount = db.prepare("SELECT COUNT(*) as n FROM questions WHERE status='approved'").get();
console.log('Done! Approved questions now:', newCount.n);

const byTopic = db.prepare(`
  SELECT topic_key, COUNT(*) as n FROM questions WHERE status='approved' GROUP BY topic_key ORDER BY topic_key
`).all();
console.log('\nBy topic:');
for (const row of byTopic) {
  console.log(`  ${row.topic_key}: ${row.n}`);
}
