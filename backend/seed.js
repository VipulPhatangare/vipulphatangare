require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('./models/Admin');
const Project = require('./models/Project');
const Achievement = require('./models/Achievement');
const Research = require('./models/Research');
const Skill = require('./models/Skill');
const Note = require('./models/Note');
const Profile = require('./models/Profile');

const seed = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  // Clear existing data
  await Promise.all([
    Admin.deleteMany({}),
    Project.deleteMany({}),
    Achievement.deleteMany({}),
    Research.deleteMany({}),
    Skill.deleteMany({}),
    Note.deleteMany({}),
    Profile.deleteMany({})
  ]);
  console.log('Cleared existing data');

  // Create admin
  await Admin.create({
    email: process.env.ADMIN_EMAIL || 'vipulphatangare3@gmail.com',
    password: process.env.ADMIN_PASSWORD || '123456'
  });
  console.log('Admin created');

  // Create profile
  await Profile.create({
    name: 'Vipul Phatangare',
    title: 'AI/ML Engineer',
    subtitle: 'Aspiring AI/ML Engineer',
    tagline: "I'm passionate about using AI and technology to solve real-world problems. I currently serve as Junior Technical Executive at PCCOE AiMSA and SDW Sports Cell Coordinator at PCCOE. I completed my internship as a Project Development Intern at CampusDekho.ai and lead Team SynthoMind, a hackathon team creating innovative, data-driven projects. I believe that engineering is the power behind possibilities, and as an engineer, I strive to use that power to transform ideas into impactful solutions.",
    githubUrl: 'https://github.com/VipulPhatangare',
    linkedinUrl: 'https://www.linkedin.com/in/vipul-phatangare-2bba15384/',
    instagramUrl: 'https://www.instagram.com/vipul_phatangare/',
    whatsappUrl: 'https://wa.me/+918999741641',
    footerText: '© 2025 Vipul Phatangare. All rights reserved.'
  });
  console.log('Profile created');

  // Create skills
  const skills = [
    'Python', 'Data Science', 'Machine Learning', 'Deep Learning', 'NLP',
    'Agentic Ai', 'C++', 'C', 'DSA', 'React', 'JavaScript', 'HTML/CSS',
    'Node.js', 'MySQL', 'MongoDB', 'PostgreSQL', 'n8n'
  ];
  await Skill.insertMany(skills.map((name, i) => ({ name, order: i })));
  console.log('Skills created');

  // Create achievements
  await Achievement.insertMany([
    {
      title: 'Winner of IEEE Innoquest 2025 Hackathon',
      description: 'National-level innovation hackathon organized by Deccan Education Society, Pune, aimed at fostering creativity, technical excellence, and real-world problem-solving among students across diverse domains.',
      icon: 'fas fa-trophy',
      order: 0
    },
    {
      title: '2 x Winner of INNS Nurathon Competition',
      description: 'Neurothon 2025 is an AI-focused hackathon organized by PCCOE\'s International Neural Network Society Cell, promoting innovation and creativity in neural network and Natural Language Processing applications.',
      icon: 'fas fa-trophy',
      order: 1
    },
    {
      title: 'Finalists at the IEEE TechSangam 2025 Hackathon',
      description: 'National-level hackathon organized by MIT ADT University, Pune, bringing together innovators and technologists to solve real-world challenges through cutting-edge AI, IoT, and data-driven solutions.',
      icon: 'fas fa-trophy',
      order: 2
    },
    {
      title: 'Project Development Intern at CampusDekho.ai',
      description: 'Successfully completed my Project Development Internship at CampusDekho.ai, where I built MHT CET data tools and automated college prediction and preference systems using the MERN stack.',
      icon: 'fas fa-briefcase',
      order: 3
    },
    {
      title: 'Research Internship Completed | AS&H PCCOE',
      description: 'Completed a research internship developing a fuzzy logic–based admission prediction system for real-world decision-making. Built and evaluated a Python-based fuzzy inference model, contributing to an international conference paper.',
      icon: 'fas fa-briefcase',
      order: 4
    }
  ]);
  console.log('Achievements created');

  // Create projects
  await Project.insertMany([
    {
      title: 'CampusDekho Preference List',
      description: 'CampusDekho Preference List is a data-driven admission support platform that generates personalized college preference lists using cutoff trends and student parameters. During my internship, I built and managed the MERN-stack backend, integrated payments and WhatsApp automation, and supported real-time production performance for 500+ students.',
      category: 'web',
      techStack: ['HTML', 'CSS', 'JavaScript', 'Node.js', 'PostgreSQL', 'Razorpay', 'WhatsApp API (Wati)', 'MongoDB'],
      demoLink: 'https://list.campusdekho.ai',
      order: 0
    },
    {
      title: 'Engimate',
      description: 'EngiMate is an AI-powered platform that simplifies the MHT-CET admission process through smart college predictions, a personalized counselling chatbot, transparent analytics, and a dynamic preference list generator. Using AI, fuzzy logic, and multi-year data, it empowers students to make informed, data-driven decisions for their academic future.',
      category: 'web',
      techStack: ['React', 'Node.js', 'PostgreSQL', 'Pinecone', 'n8n', 'Gemini/OpenAI API'],
      demoLink: 'http://engimate.synthomind.cloud',
      codeLink: 'https://github.com/VipulPhatangare/engimate-2',
      order: 1
    },
    {
      title: 'Researcher',
      description: 'Built Researcher, an agentic AI–powered research automation platform that autonomously performs problem analysis, literature review, gap identification, and solution generation using multi-phase LLM workflows. Reduced end-to-end research time from weeks to under an hour through parallel AI pipelines, n8n-driven orchestration, and a scalable MERN-based architecture.',
      category: 'agentic',
      techStack: ['React', 'Node.js', 'MongoDB(Vector)', 'n8n', 'arxiv API', 'Github API', 'Google Search API', 'Gemini/OpenAI API'],
      demoLink: 'https://researcher.synthomind.cloud/',
      codeLink: 'https://github.com/VipulPhatangare/Researcher',
      order: 2
    },
    {
      title: 'Datathon',
      description: 'Built a full-stack Datathon platform to automate CSV-based submission evaluation, computing Accuracy, Precision, Recall, and F1 Score with real-time leaderboard rankings. Implemented secure authentication, submission validation, admin controls, and scalable MERN architecture, deploying a production-ready system using PM2, Nginx, and MongoDB.',
      category: 'web',
      techStack: ['React', 'Node.js', 'WebSocket', 'MongoDB'],
      demoLink: 'http://datathon.gfgpccoe.in/',
      codeLink: 'https://github.com/VipulPhatangare/datathon-round2',
      order: 3
    },
    {
      title: 'Shuttle Showdown',
      description: 'All-in-one badminton management platform enabling players to register, view upcoming and completed matches, and track scores. Referees can manage matches with dynamic rules and real-time scorecards, while admins oversee players, generate schedules, allocate matches, and handle complete event management efficiently.',
      category: 'web',
      techStack: ['HTML', 'CSS', 'JavaScript', 'Node.js', 'MongoDB'],
      demoLink: 'https://badminton-test.onrender.com/',
      order: 4
    },
    {
      title: "Vipul's AI Assistant",
      description: "This project is a personalized AI assistant chatbot that answers questions about Vipul's skills, experience, and projects, acting as an interactive portfolio and 24/7 professional representative. It integrates AI workflows, stores chat history, and provides a modern, responsive interface for visitors and potential clients.",
      category: 'agentic',
      techStack: ['HTML', 'CSS', 'JavaScript', 'Node.js', 'MongoDB(vector)', 'n8n', 'OpenAI/Gemini'],
      demoLink: 'https://vipul-chatbot.onrender.com',
      codeLink: 'https://github.com/VipulPhatangare/vipul-chatbot',
      order: 5
    },
    {
      title: 'Nurathon 2025',
      description: 'A deep learning–based binary classification system built using a fully processed tabular dataset. The project includes dataset cleaning, feature encoding, scaling, and class imbalance handling, followed by training a neural network with dropout, batch normalization, and adaptive learning strategies to generate final predictions for unseen test data.',
      category: 'ml',
      techStack: ['Python', 'Scikit-learn', 'NumPy', 'Pandas', 'TensorFlow / Keras', 'StandardScaler', 'Label Encoding'],
      driveLink: 'https://drive.google.com/drive/folders/19vbgloBYVLR4KpATGJdLMzqpR_PTgCgf?usp=sharing',
      order: 6
    },
    {
      title: 'Pet & Human Detection System',
      description: 'This project is a real-time AI detection system that identifies humans, cats, and dogs using YOLOv8 with support for both uploaded media and live phone camera streaming. It features a full-stack setup with live analytics, annotation overlays, and deployable containerized architecture for applications like monitoring and security.',
      category: 'ml',
      techStack: ['Python', 'YOLOv8', 'Node.js', 'Express.js', 'WebSockets', 'HTML', 'CSS', 'JavaScript'],
      demoLink: 'https://eai.synthomind.cloud',
      codeLink: 'https://github.com/VipulPhatangare/Pets-vs-Humans-Detection-System',
      order: 7
    },
    {
      title: 'Healthy Plant Detection',
      description: 'A machine learning model for plant health detection with 93% accuracy, using ensemble techniques and PCA to classify diseases through leaf images with explainable AI.',
      category: 'ml',
      techStack: ['Python', 'Scikit-learn', 'OpenCV', 'NumPy', 'Pandas', 'Matplotlib', 'XGBoost', 'Random Forest'],
      codeLink: 'https://github.com/VipulPhatangare/Healthy-Plant-Detection',
      driveLink: 'https://drive.google.com/drive/folders/1TDWlIFTEb9Y1VCCSo5WerrRvMNLNYRTA?usp=sharing',
      order: 8
    },
    {
      title: 'Phone Stream Project',
      description: 'This project turns a smartphone into a wireless streaming camera by capturing live video and sending compressed frames to a Node.js WebSocket server. It supports multi-device viewing, real-time FPS tracking, and smooth remote monitoring without heavy frameworks.',
      category: 'web',
      techStack: ['HTML', 'CSS', 'JavaScript', 'Node.js', 'WebSocket (ws)', 'MediaDevices API'],
      demoLink: 'https://phone-stream.onrender.com',
      codeLink: 'https://github.com/VipulPhatangare/phone_stream',
      order: 9
    },
    {
      title: 'Slot Booking System',
      description: 'This is a web-based Slot Booking System that allows users to book time-based slots on specific days. The system features a user-friendly interface for selecting available slots and includes an admin panel for managing bookings, time slots, and user data. It is ideal for services requiring scheduled appointments or reservations.',
      category: 'web',
      techStack: ['HTML', 'CSS', 'JavaScript', 'Node.js', 'MongoDB', 'PostgreSQL'],
      demoLink: 'https://campusdekho.onrender.com',
      codeLink: 'https://github.com/VipulPhatangare/slotbooking',
      order: 10
    },
    {
      title: 'MTH CET Percentile Predictor',
      description: 'Predicts MHT CET percentile using student\'s marks, exam date, and shift. Helps students estimate their score before results. Simple, fast, and easy to use.',
      category: 'web',
      techStack: ['HTML', 'CSS', 'JavaScript', 'Node.js', 'PostgreSQL'],
      demoLink: 'https://mht-cet-percentile-predictor.onrender.com/',
      codeLink: 'https://github.com/VipulPhatangare/mht_cet_percentile_predictor',
      order: 11
    },
    {
      title: 'Nurathon 2024',
      description: 'A Natural Language Processing project using Logistic Regression, TF-IDF Vectorization, Ordinal Encoding, and Scikit-learn to classify customer complaints into product categories from noisy financial service data.',
      category: 'ml',
      techStack: ['Python', 'Scikit-learn', 'NumPy', 'Pandas', 'TfidfVectorizer', 'OrdinalEncoder', 'LogisticRegression'],
      codeLink: 'https://github.com/VipulPhatangare/Nurathon/tree/main',
      driveLink: 'https://drive.google.com/drive/folders/1skW3L63Aj5lpAQSXEovYKM33doENL1Mm?usp=sharing',
      order: 12
    },
    {
      title: 'Spotify Clone',
      description: 'This project is a simple Spotify clone made using HTML and CSS. It shows a music player UI with sidebar, song list, and basic layout.',
      category: 'web',
      techStack: ['HTML', 'CSS'],
      demoLink: 'https://spotify-clone-vert-one.vercel.app/',
      codeLink: 'https://github.com/VipulPhatangare/spotify-clone',
      order: 13
    }
  ]);
  console.log('Projects created');

  // Create research papers
  await Research.insertMany([
    {
      title: 'Comparative Study Of Machine learning models For Healthy Plant Detection',
      authors: 'Vipul Phatangare, Sujata Swami, Adinna Thaware, Diksha Bhosale',
      abstract: 'This paper focuses on detecting whether a plant leaf is healthy or not using machine learning. It compares six different ML algorithms like SVM, Random Forest, and XGBoost to find out which one works best. The team used images of leaves from plants like mango, bell pepper, potato, and Pongamia Pinnata. Since the image data was large, they used PCA to reduce its size while keeping important information. After training and testing all the models, SVM gave the best results with 93.63% accuracy. This approach can help farmers detect diseases early and take better care of their crops.',
      paperLink: 'https://docs.google.com/document/d/1AJEhwv3OHALQ51jFJCvMahWNadcUX6h2/edit?usp=sharing&ouid=100781584262485760601&rtpof=true&sd=true',
      order: 0
    },
    {
      title: 'A FUZZY LOGIC-BASED SOFT COMPUTING APPROACH FOR ENGINEERING COLLEGE ADMISSION IN MAHARASHTRA',
      authors: 'Dinesh Kute, Vipul Phatangare, Shashwati Band, Arati Shirahatti, Mannat, Niraj Ingle, Sayali Wabale',
      abstract: 'The research paper proposes a fuzzy logic–based soft computing framework to assist engineering college admission decisions in Maharashtra under the MHT-CET process. The model addresses uncertainty in admission cutoffs by incorporating multiple factors such as rank gap, category, branch preference, gender, and geographic constraints. A Mamdani fuzzy inference system was implemented in Python to compute a suitability score for each college–branch combination. The system outperformed traditional crisp cutoff and ML-based approaches by effectively handling imprecise and linguistic data. Experimental evaluation demonstrated an admission prediction accuracy of up to 88%, significantly reducing manual effort in preference selection. The work highlights fuzzy logic as a practical, interpretable, and scalable decision-support tool for real-world educational systems.',
      paperLink: 'https://drive.google.com/file/d/1MkMAe8T1j6Vo0QVewyTEm1eZCW9yDy8N/view?usp=sharing',
      order: 1
    }
  ]);
  console.log('Research papers created');

  // Create notes
  await Note.insertMany([
    {
      title: 'ML Fundamentals',
      description: 'Comprehensive notes covering supervised and unsupervised learning algorithms, model evaluation metrics, feature engineering techniques, etc.',
      category: 'ml',
      link: 'https://drive.google.com/file/d/1CxMrKAyrkgVVntkQhRUdDAOB00RNIaIL/view?usp=sharing',
      linkText: 'Download PDF',
      order: 0
    },
    {
      title: 'ML Practicals',
      description: 'A comprehensive guide featuring hands-on implementations of essential machine learning algorithms from scratch, with detailed code explanations to enhance understanding and mastery of core ML concepts and techniques.',
      category: 'ml',
      link: 'https://drive.google.com/drive/folders/1zgLRPKf0ZVNOkp_eZLakMcJvKLrCmWCj?usp=sharing',
      linkText: 'View',
      order: 1
    },
    {
      title: 'C++ and DSA',
      description: 'C++ and DSA notes cover fundamental to advanced topics including arrays, strings, linked lists, trees, sorting algorithms, graphs and DP.',
      category: 'algo',
      link: 'https://drive.google.com/file/d/1YZw2gy2-whJXZBi0ZMWjYws9sX4LAWm8/view?usp=sharing',
      linkText: 'Download PDF',
      order: 2
    },
    {
      title: 'HTML',
      description: 'These HTML notes cover the fundamentals of web development, including tags, elements, attributes, and structure, helping learners build and design basic web pages efficiently.',
      category: 'webdev',
      link: 'https://drive.google.com/file/d/1dH1awzF3ue2QlK_y_xlOOdBuLlloC1-P/view?usp=sharing',
      linkText: 'Download PDF',
      order: 3
    },
    {
      title: 'CSS',
      description: 'These CSS notes provide a concise overview of Cascading Style Sheets, covering selectors, properties, layouts, and styling techniques essential for designing visually appealing web pages.',
      category: 'webdev',
      link: 'https://drive.google.com/file/d/1OkXnldTt7ILkkb3fEMalO70-E_VxUfAT/view?usp=sharing',
      linkText: 'Download PDF',
      order: 4
    },
    {
      title: 'JavaScript',
      description: 'These JavaScript notes cover essential concepts, syntax, and examples to help beginners understand and practice JS fundamentals for web development and interactive programming.',
      category: 'webdev',
      link: 'https://drive.google.com/file/d/1CN7ecnHL7X3hc-HVouneHyv2K0x-Bx7C/view?usp=sharing',
      linkText: 'Download PDF',
      order: 5
    },
    {
      title: 'Node.js',
      description: 'These Node.js notes cover core concepts, modules, asynchronous programming, and server creation, providing a concise guide for building scalable, efficient backend applications using JavaScript.',
      category: 'webdev',
      link: 'https://drive.google.com/file/d/18lZXfN7BxfOHimT7HWy_d67aQHKUtwAP/view?usp=sharing',
      linkText: 'Download PDF',
      order: 6
    },
    {
      title: 'SQL',
      description: 'SQL notes cover essential concepts, commands, and queries for database management, ideal for beginners and developers to understand, practice, and master SQL efficiently.',
      category: 'dbms',
      link: 'https://drive.google.com/file/d/1LBZskVHBR5hIvBoPiBI1QggDleESFrs0/view?usp=sharing',
      linkText: 'Download PDF',
      order: 7
    },
    {
      title: 'MongoDB',
      description: 'MongoDB notes cover essential concepts, commands, and queries for database management, ideal for beginners and developers to understand, practice, and master MongoDB efficiently.',
      category: 'dbms',
      link: 'https://drive.google.com/file/d/1xLqIXX5EWkpWci2t7GD25f3UAN-VYetA/view?usp=sharing',
      linkText: 'Download PDF',
      order: 8
    },
    {
      title: 'Data Science Codes',
      description: 'Hands-on data science code implementations covering data preprocessing, visualization, machine learning models, and evaluation techniques for real-world problem-solving using Python and popular libraries.',
      category: 'datascience',
      link: 'https://drive.google.com/drive/folders/1PI6H0TAJqNC8Pr1EC2-WwhjutTz_oUqI?usp=sharing',
      linkText: 'View',
      order: 9
    }
  ]);
  console.log('Notes created');

  console.log('\nSeed completed successfully!');
  console.log(`Admin login: ${process.env.ADMIN_EMAIL} / ${process.env.ADMIN_PASSWORD}`);
  process.exit(0);
};

seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
