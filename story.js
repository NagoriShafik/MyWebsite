/* story.js: everything you may want to edit lives here.
   Waypoints, destinations, the cast of people, and ALL the words shown to visitors. */
(function () {
  var SO = (window.SO = window.SO || {});
  var P = Math.PI;

  var EMAIL = 'nagorishafiq1996.se@gmail.com';

  SO.story = {
    email: EMAIL,
    links: [
      { label: 'LinkedIn', href: 'https://www.linkedin.com/in/nagori-shafik-9992b9165/' },
      { label: 'GitHub', href: 'https://github.com/NagoriShafik' },
      { label: 'HackerRank', href: 'https://www.hackerrank.com/nagorishafiq1996' }
    ],

    /* walkable waypoints: id: [x, z, room] */
    nodes: {
      out: [0, 31, 'outside'], plz: [0, 24.5, 'outside'], fd: [0, 19.4, 'outside'],
      lob: [0, 15.3, 'lobby'], rec: [0, 13.3, 'lobby'], lobE: [3.7, 14, 'lobby'], lobM: [3.7, 9, 'lobby'], lobN: [0, 7.6, 'lobby'], gdesk: [0, 10.2, 'lobby'],
      hd: [0, 6, 'hall'], h1: [0, 1.5, 'hall'], h2: [0, -9.5, 'hall'], h3: [0, -12.8, 'hall'], od: [0, -14, 'hall'],
      of: [0, -18.7, 'owner'],
      wd: [-3, 1.5, 'hall'], s_erp: [-5.9, -1.9, 'work'], s_safe: [-9.2, -1.9, 'work'], s_movie: [-12.5, -1.9, 'work'],
      ld: [-3, -9.5, 'hall'], lab0: [-6.2, -10, 'lab'], lab1: [-9, -11.7, 'lab'], lab2: [-12.1, -9, 'lab'],
      ed: [3, 1.5, 'hall'], mtA: [5, -0.6, 'meet'], m1: [8.6, -1.5, 'meet'],
      ld2: [3, -9.5, 'hall'], lg0: [5.4, -10.4, 'lounge'], l_coffee: [6.4, -11.9, 'lounge'], l_hello: [7.4, -9.7, 'lounge']
    },
    edges: [
      ['out', 'plz'], ['plz', 'fd'], ['fd', 'lob'], ['lob', 'rec'], ['lob', 'lobE'], ['lobE', 'lobM'], ['lobM', 'lobN'], ['lobM', 'gdesk'],
      ['lobN', 'hd'], ['hd', 'h1'], ['h1', 'h2'], ['h2', 'h3'], ['h3', 'od'], ['od', 'of'],
      ['h1', 'wd'], ['wd', 's_erp'], ['s_erp', 's_safe'], ['s_safe', 's_movie'],
      ['h2', 'ld'], ['ld', 'lab0'], ['lab0', 'lab1'], ['lab0', 'lab2'],
      ['h1', 'ed'], ['ed', 'mtA'], ['mtA', 'm1'],
      ['h2', 'ld2'], ['ld2', 'lg0'], ['lg0', 'l_coffee'], ['lg0', 'l_hello']
    ],

    /* named rooms (for the little tag on screen and for "where am I") */
    rooms: [
      { id: 'lobby', name: 'Reception', x1: -15, z1: 6, x2: 15, z2: 18 },
      { id: 'hall', name: 'Main hall', x1: -3, z1: -14, x2: 3, z2: 6 },
      { id: 'work', name: 'Work floor', x1: -15, z1: -4, x2: -3, z2: 6 },
      { id: 'lab', name: 'Research lab', x1: -15, z1: -14, x2: -3, z2: -4 },
      { id: 'meet', name: 'Meeting room', x1: 3, z1: -4, x2: 15, z2: 6 },
      { id: 'lounge', name: 'Coffee lounge', x1: 3, z1: -14, x2: 15, z2: -4 },
      { id: 'owner', name: "Nagori's office", x1: -6, z1: -24, x2: 6, z2: -14 }
    ],

    /* destinations: v = where the visitor stands [x, z, facing], g = where the guide stands */
    dests: {
      reception: { room: 'Reception', vNode: 'rec', gNode: 'gdesk', v: [0, 13.3, P], g: [0, 10.2, 0] },
      erp: { room: 'Work floor', vNode: 's_erp', gNode: 's_erp', v: [-5.9, -1.9, P], g: [-4.7, -1.6] },
      safety: { room: 'Work floor', vNode: 's_safe', gNode: 's_safe', v: [-9.2, -1.9, P], g: [-8.0, -1.6] },
      movie: { room: 'Work floor', vNode: 's_movie', gNode: 's_movie', v: [-12.5, -1.9, P], g: [-11.3, -1.6] },
      causal: { room: 'Research lab', vNode: 'lab1', gNode: 'lab1', v: [-9, -11.6, P], g: [-7.8, -11.3] },
      pipeline: { room: 'Research lab', vNode: 'lab2', gNode: 'lab2', v: [-12.1, -9, -P / 2], g: [-12.0, -7.7] },
      about: { room: 'Meeting room', vNode: 'm1', gNode: 'm1', v: [8.6, -1.5, P], g: [9.9, -1.3] },
      coffee: { room: 'Coffee lounge', vNode: 'l_coffee', gNode: 'l_coffee', v: [6.4, -11.9, P], g: [7.6, -11.6] },
      hello: { room: 'Coffee lounge', vNode: 'l_hello', gNode: 'l_hello', v: [7.4, -9.7, P / 2], g: [7.4, -8.4] },
      owner: { room: "Nagori's office", vNode: 'of', gNode: 'of', v: [0, -18.7, P], g: [1.6, -18.2] }
    },
    /* things that share a spot with another destination */
    alias: { skills: 'about', ways: 'about' },

    /* guided tours: the guide offers "Next" through these */
    tours: { work: ['erp', 'safety', 'movie'], lab: ['causal', 'pipeline'], meet: ['about', 'skills', 'ways'], lounge: ['coffee', 'hello'], owner: ['owner'] },
    tourOf: { erp: 'work', safety: 'work', movie: 'work', causal: 'lab', pipeline: 'lab', about: 'meet', skills: 'meet', ways: 'meet', coffee: 'lounge', hello: 'lounge', owner: 'owner' },

    /* the receptionist's menu */
    greeting: "Good {part}, {n}! Welcome to Shafik Studio. I'm the AI Assistant on the front desk. What brings you in today?",
    again: 'Welcome back, {n}! Where to next?',
    intros: ['Here we are, {n}. ', 'Take a look, {n}. ', 'This one is worth a close look, {n}. ', 'Right this way, {n}. '],
    menu: [
      { label: 'See the work', sub: 'Projects on the work floor', go: 'erp', lead: 'Of course, {n}! Follow me to the work floor.' },
      { label: 'AI & data research', sub: 'The research lab', go: 'causal', lead: 'The lab it is, {n}. This way, please.' },
      { label: 'Who runs this place?', sub: 'Meeting room: about & skills', go: 'about', lead: "Let's head to the meeting room, {n}. Follow me!" },
      { label: 'Talk to the owner', sub: "Nagori's office: contact", go: 'owner', lead: "Nagori's office is at the end of the hall, {n}. Follow me!" },
      { label: 'Coffee & a chat', sub: 'The lounge', go: 'coffee', lead: 'Good choice, {n}. The lounge is this way.' },
      { label: 'Let me look around', sub: 'Walk freely', free: true, lead: 'Of course, {n}. Make yourself at home!' }
    ],

    /* what is on each stop. (Edit freely.) */
    content: {
      erp: {
        room: 'Work floor', title: 'ERP & Stock Platform', tag: 'Enterprise data platform',
        text: 'A production ERP and stock platform, delivered with a cross-functional team: an Angular front end, a Node.js and Express API and tuned MySQL schemas. Custom ETL workflows automate extraction and loading, stock syncs in real time with third-party APIs with automated alerts, and dashboards handle analytics and reporting.',
        chips: ['Angular', 'Node.js', 'Express', 'MySQL', 'REST', 'TDD & CI']
      },
      safety: {
        room: 'Work floor', title: "Women's Safety Alerts", tag: 'Emergency response core',
        text: "The emergency-response core of a personal safety app. One trigger sends an SMS, through an integrated service, to police and family contacts with the user's live location, battery status and details.",
        chips: ['SMS integration', 'Live location', 'Real-time alerts']
      },
      movie: {
        room: 'Work floor', title: 'MovieDB · MERN', tag: 'Full-stack catalogue app',
        text: 'A full-stack movie catalogue on the MERN stack: a React front end talking to a Node.js and Express API, with MongoDB behind it.',
        chips: ['MongoDB', 'Express', 'React', 'Node.js']
      },
      causal: {
        room: 'Research lab', title: 'Causal AI · credit risk', tag: 'Models you can question',
        text: 'Credit-risk research comparing Logistic Regression, Random Forest and Gradient Boosting, then going further: a causal framework built on DAGs and counterfactual reasoning to test how each model behaves and whether it treats people fairly.',
        chips: ['Python', 'scikit-learn', 'Causal inference', 'Fairness']
      },
      pipeline: {
        room: 'Research lab', title: 'Data pipeline research', tag: 'Messy data in, features out',
        text: 'Applied research into hybrid ML models for product data enrichment: ETL pipelines and automated feature engineering that turn inconsistent product records into something a model can learn from.',
        chips: ['ETL', 'Feature engineering', 'NLP', 'Data engineering', 'Distributed systems']
      },
      about: {
        room: 'Meeting room', title: 'About Nagori', slide: 0,
        text: 'Nagori is a full-stack engineer who builds web platforms with machine learning built in: dependable backends, clean data pipelines and interfaces people enjoy using. MSc in Data & AI. He ships independently or inside larger teams.',
        chips: ['Full-stack', 'Applied ML', 'Remote-friendly']
      },
      skills: {
        room: 'Meeting room', title: 'The toolbox', slide: 1,
        text: 'Python, TypeScript, JavaScript, SQL and Java. scikit-learn and TensorFlow for ML. Node.js, Express, REST, JWT and OAuth. MySQL, PostgreSQL, MongoDB and SQL Server. React and Angular. AWS and GCP.',
        chips: ['Python', 'TypeScript', 'Node.js', 'React', 'Angular', 'SQL', 'TensorFlow', 'AWS / GCP']
      },
      ways: {
        room: 'Meeting room', title: 'How he works', slide: 4,
        text: 'Comfortable alone or inside a larger team: agile delivery, careful code review, TDD and CI, clear documentation and remote-first communication. Available remotely or hybrid.',
        chips: ['Agile', 'Code review', 'TDD', 'CI/CD', 'Documentation']
      },
      coffee: {
        room: 'Coffee lounge', title: 'Take five',
        text: 'Nagori works with teams remotely and in person, and speaks English, Hindi and Gujarati. Pour a coffee, then walk over to the TV and say hello.',
        chips: ['English', 'Hindi', 'Gujarati']
      },
      hello: {
        room: 'Coffee lounge', title: 'Hello · Namaste · Kem cho', tv: true,
        text: 'Say hello in whichever language you like, {n}. You can also find Nagori elsewhere online:',
        links: true
      },
      owner: {
        room: "Nagori's office", title: "Nagori's office", contact: true,
        text: "Hi {n}, I'm Nagori. Thanks for stopping by. Have a project, or a team that needs another strong engineer? I work independently and alongside larger teams, remotely or hybrid. Send me a note and I'll reply quickly.",
        chips: ['Projects', 'Team work', 'Applied ML']
      }
    },

    /* the people */
    cast: [
      { id: 'riya', name: 'AI Assistant', role: 'Reception', kind: 'stand', x: 0, z: 10.2, yaw: 0, label: true, look: { skin: 0xc68642, shirt: 0x1d7a8c, pants: 0x2b2d42, hair: 0x2b1b12, hairStyle: 'bun', scale: 0.94 } },
      { id: 'nagori', name: 'Nagori', role: 'Owner', kind: 'seat', x: 0, z: -22.2, yaw: 0, type: true, label: true, look: { skin: 0xc08a64, shirt: 0x25324a, pants: 0x1f2433, hair: 0x15110e, hairStyle: 'short', beard: true } },

      { kind: 'seat', x: -13, z: 2.5, yaw: P, type: true, look: { skin: 0xe0b48a, shirt: 0x2a9d8f, hair: 0x1b1b1b, hairStyle: 'short' } },
      { kind: 'seat', x: -10.5, z: 2.5, yaw: P, type: true, look: { skin: 0x8d5524, shirt: 0xe76f51, hair: 0x111111, hairStyle: 'curly' } },
      { kind: 'seat', x: -8, z: 2.5, yaw: P, type: true, look: { skin: 0xf1c27d, shirt: 0x6d597a, hair: 0x5b3a1e, hairStyle: 'long', glasses: true } },
      { kind: 'seat', x: -13, z: 5.3, yaw: P, type: true, look: { skin: 0xc68642, shirt: 0x457b9d, hair: 0x2b1b12, hairStyle: 'bun' } },
      { kind: 'seat', x: -10.5, z: 5.3, yaw: P, type: true, look: { skin: 0xe0ac69, shirt: 0xf4a261, hair: 0x3b2a20, hairStyle: 'short', beard: true } },
      { kind: 'seat', x: -8, z: 5.3, yaw: P, type: true, look: { skin: 0xffdbac, shirt: 0xe9c46a, hair: 0x222222, hairStyle: 'long' } },

      { kind: 'seat', x: -9, z: -6, yaw: P, type: true, look: { skin: 0xd2a679, shirt: 0xffffff, hair: 0x2a2a2a, hairStyle: 'short', glasses: true, coat: true } },
      { kind: 'seat', x: -6.2, z: -6, yaw: P, type: true, look: { skin: 0x9c6b46, shirt: 0xe9ecef, hair: 0x111111, hairStyle: 'curly', coat: true } },
      { kind: 'stand', x: -11.4, z: -12.6, yaw: P, talk: true, look: { skin: 0xf1c27d, shirt: 0x6d597a, hair: 0x6b3f1d, hairStyle: 'long', coat: true } },

      { kind: 'seat', x: 7.2, z: 4, yaw: P, look: { skin: 0xe0b48a, shirt: 0x457b9d, hair: 0x222222, hairStyle: 'short' } },
      { kind: 'seat', x: 9, z: 4, yaw: P, look: { skin: 0x8d5524, shirt: 0x2a9d8f, hair: 0x111111, hairStyle: 'curly' } },
      { kind: 'seat', x: 10.8, z: 4, yaw: P, look: { skin: 0xf3c9a0, shirt: 0xe76f51, hair: 0x7a4a24, hairStyle: 'bun' } },
      { kind: 'stand', x: 12.4, z: -2.4, yaw: 2.5, talk: true, look: { skin: 0xc68642, shirt: 0x264653, hair: 0x1b1b1b, hairStyle: 'short', glasses: true } },

      { id: 'chat1', kind: 'stand', x: 9.7, z: -12.1, yaw: P / 2, chat: 'chat2', look: { skin: 0xe0ac69, shirt: 0xf4a261, hair: 0x2b1b12, hairStyle: 'long' } },
      { id: 'chat2', kind: 'stand', x: 10.7, z: -12.1, yaw: -P / 2, chat: 'chat1', look: { skin: 0x8d5524, shirt: 0x6d597a, hair: 0x111111, hairStyle: 'short', beard: true } },

      { kind: 'seat', x: -8.2, z: 9.2, y: 0.06, yaw: 0, lookDown: true, look: { skin: 0xf1c27d, shirt: 0x90be6d, hair: 0x3b2a20, hairStyle: 'short' } },

      { kind: 'walker', x: 0, z: -2, look: { skin: 0xd2a679, shirt: 0xf94144, hair: 0x1b1b1b, hairStyle: 'short' } },
      { kind: 'walker', x: 0, z: -8, look: { skin: 0xe0b48a, shirt: 0x43aa8b, hair: 0x4a2c17, hairStyle: 'long', glasses: true } }
    ],
    walkerGoals: ['s_movie', 'lab1', 'm1', 'l_coffee', 'lobM', 's_safe', 'lab2', 'h3', 'l_hello', 's_erp']
  };
})();
