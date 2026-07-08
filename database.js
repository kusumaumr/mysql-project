// ============================================================
//  Job Tracker — In-Memory Database Simulator
//  Simulates MySQL tables, stored procedures & triggers
// ============================================================

const DB = {
  // ── AUTO-INCREMENT COUNTERS ──────────────────────────────
  _counters: {
    users: 0,
    companies: 0,
    jobs: 0,
    applications: 0,
    interview_rounds: 0,
    interview_status: 0,
    offers: 0,
    rejection: 0,
  },

  // ── TABLES ───────────────────────────────────────────────
  users: [],
  companies: [],
  jobs: [],
  applications: [],
  interview_rounds: [],
  interview_status: [],
  offers: [],
  rejection: [],

  // ── SQL EVENT LOG ─────────────────────────────────────────
  sqlLog: [],
  triggerLog: [],

  // ─────────────────────────────────────────────────────────
  //  HELPER UTILITIES
  // ─────────────────────────────────────────────────────────
  _nextId(table) {
    return ++this._counters[table];
  },

  _log(sql, type = 'QUERY') {
    const entry = {
      id: this.sqlLog.length + 1,
      timestamp: new Date().toLocaleTimeString(),
      type,
      sql,
    };
    this.sqlLog.unshift(entry);
    if (window._onSqlLog) window._onSqlLog(entry);
    return entry;
  },

  _triggerFired(name, detail) {
    const entry = { name, detail, timestamp: new Date().toLocaleTimeString() };
    this.triggerLog.unshift(entry);
    if (window._onTriggerFired) window._onTriggerFired(entry);
  },

  // ─────────────────────────────────────────────────────────
  //  STORED PROCEDURES
  // ─────────────────────────────────────────────────────────

  /** INSERT INTO users */
  insert_user(name, email, phone) {
    const user_id = this._nextId('users');
    const row = { user_id, name, email, phone };
    this.users.push(row);
    this._log(`CALL insert_user('${name}', '${email}', '${phone}');`, 'PROCEDURE');
    return row;
  },

  /** INSERT INTO companies */
  insert_company(companie_name, location, industry) {
    const companie_id = this._nextId('companies');
    const row = { companie_id, companie_name, location, industry };
    this.companies.push(row);
    this._log(`CALL insert_company('${companie_name}', '${location}', '${industry}');`, 'PROCEDURE');
    return row;
  },

  /** INSERT INTO jobs */
  insert_job(company_id, job_title, package_) {
    const company = this.companies.find(c => c.companie_id === company_id);
    if (!company) throw new Error(`Company ID ${company_id} not found.`);
    const job_id = this._nextId('jobs');
    const row = { job_id, company_id, job_title, package: package_ };
    this.jobs.push(row);
    this._log(`CALL insert_job(${company_id}, '${job_title}', ${package_});`, 'PROCEDURE');
    return row;
  },

  /** INSERT INTO applications  +  Trigger: trg_after_application_selected_interview */
  add_application(user_id, job_id, apply_date, status, rejection_reason = null) {
    const user = this.users.find(u => u.user_id === user_id);
    if (!user) throw new Error(`User ID ${user_id} not found.`);
    const job = this.jobs.find(j => j.job_id === job_id);
    if (!job) throw new Error(`Job ID ${job_id} not found.`);

    const application_id = this._nextId('applications');
    const row = { application_id, user_id, job_id, apply_date, status, rejection_reason };
    this.applications.push(row);
    this._log(
      `CALL add_application(${user_id}, ${job_id}, '${apply_date}', '${status}', ${rejection_reason ? `'${rejection_reason}'` : 'NULL'});`,
      'PROCEDURE'
    );

    // ── TRIGGER: trg_after_application_selected_interview ──
    if (status === 'Selected') {
      const round_id = this._nextId('interview_rounds');
      const today = new Date().toISOString().split('T')[0];
      const roundRow = {
        round_id,
        application_id,
        round_name: 'Technical Round',
        results: 'Pending',
        round_date: today,
      };
      this.interview_rounds.push(roundRow);
      this._log(
        `-- ⚡ TRIGGER: trg_after_application_selected_interview\nINSERT INTO interview_rounds(application_id, round_name, results, round_date)\nVALUES(${application_id}, 'Technical Round', 'Pending', CURDATE());`,
        'TRIGGER'
      );
      this._triggerFired('trg_after_application_selected_interview', `Interview Round auto-created for Application #${application_id}`);
    }

    return row;
  },

  /** INSERT INTO interview_status  +  Triggers: offer / rejection */
  add_interview_status(round_id, status) {
    const round = this.interview_rounds.find(r => r.round_id === round_id);
    if (!round) throw new Error(`Round ID ${round_id} not found.`);

    const int_st_id = this._nextId('interview_status');
    const row = { int_st_id, round_id, status };
    this.interview_status.push(row);
    // Update round result
    round.results = status;
    this._log(`CALL add_interview_status(${round_id}, '${status}');`, 'PROCEDURE');

    // ── TRIGGER: trg_after_interview_status_offer ──────────
    if (status === 'Selected') {
      const offer_id = this._nextId('offers');
      const today = new Date().toISOString().split('T')[0];
      const offerRow = { offer_id, int_st_id, status: 'Offer Released', join_date: today };
      this.offers.push(offerRow);
      this._log(
        `-- ⚡ TRIGGER: trg_after_interview_status_offer\nINSERT INTO offers(int_st_id, status, join_date)\nVALUES(${int_st_id}, 'Offer Released', CURDATE());`,
        'TRIGGER'
      );
      this._triggerFired('trg_after_interview_status_offer', `Offer auto-created for Interview Status #${int_st_id}`);
    }

    // ── TRIGGER: trg_after_interview_status_rejection ──────
    if (status === 'Rejected') {
      const rejection_id = this._nextId('rejection');
      const rejRow = { rejection_id, int_st_id, status: 'Application Rejected' };
      this.rejection.push(rejRow);
      this._log(
        `-- ⚡ TRIGGER: trg_after_interview_status_rejection\nINSERT INTO rejection(int_st_id, status)\nVALUES(${int_st_id}, 'Application Rejected');`,
        'TRIGGER'
      );
      this._triggerFired('trg_after_interview_status_rejection', `Rejection auto-created for Interview Status #${int_st_id}`);
    }

    return row;
  },

  // ─────────────────────────────────────────────────────────
  //  SIMPLE SQL CONSOLE EXECUTOR
  // ─────────────────────────────────────────────────────────
  executeQuery(sql) {
    const s = sql.trim().toUpperCase();
    this._log(sql, 'CONSOLE');

    const tableMap = {
      USERS: 'users',
      COMPANIES: 'companies',
      JOBS: 'jobs',
      APPLICATIONS: 'applications',
      INTERVIEW_ROUNDS: 'interview_rounds',
      INTERVIEW_STATUS: 'interview_status',
      OFFERS: 'offers',
      REJECTION: 'rejection',
    };

    // SELECT * FROM <table>
    const selectStar = s.match(/^SELECT\s+\*\s+FROM\s+(\w+)/);
    if (selectStar) {
      const tName = selectStar[1].replace(/_/g, '_');
      const key = Object.keys(tableMap).find(k => k === tName);
      if (key) return { rows: this[tableMap[key]], error: null };
      return { rows: [], error: `Table '${selectStar[1]}' not found.` };
    }

    // COUNT
    const countMatch = s.match(/^SELECT\s+COUNT\(\*\)\s+FROM\s+(\w+)/);
    if (countMatch) {
      const key = Object.keys(tableMap).find(k => k === countMatch[1]);
      if (key) return { rows: [{ 'COUNT(*)': this[tableMap[key]].length }], error: null };
    }

    // Full join report
    if (s.includes('FROM USERS') && s.includes('JOIN APPLICATIONS')) {
      return { rows: this._fullReport(), error: null };
    }

    return { rows: [], error: 'Only basic SELECT * FROM <table> and SELECT COUNT(*) FROM <table> are supported in this console.' };
  },

  _fullReport() {
    return this.applications.map(a => {
      const user = this.users.find(u => u.user_id === a.user_id) || {};
      const job = this.jobs.find(j => j.job_id === a.job_id) || {};
      const company = this.companies.find(c => c.companie_id === job.company_id) || {};
      const ir = this.interview_rounds.find(r => r.application_id === a.application_id);
      const is_ = ir ? this.interview_status.find(s => s.round_id === ir.round_id) : null;
      const offer = is_ ? this.offers.find(o => o.int_st_id === is_.int_st_id) : null;
      const rej = is_ ? this.rejection.find(r => r.int_st_id === is_.int_st_id) : null;

      return {
        name: user.name || '-',
        companie_name: company.companie_name || '-',
        job_title: job.job_title || '-',
        application_status: a.status,
        round_name: ir ? ir.round_name : '-',
        results: ir ? ir.results : '-',
        interview_status: is_ ? is_.status : '-',
        offer_status: offer ? offer.status : '-',
        rejection_status: rej ? rej.status : '-',
      };
    });
  },

  // ─────────────────────────────────────────────────────────
  //  SEED DATA  (mirrors the SQL CALLs in the user's script)
  // ─────────────────────────────────────────────────────────
  seed() {
    // Users
    ['kusuma|kusuma@gmail.com|7654865874',
     'suma|suma@gmail.com|9654865874',
     'uma|ma@gmail.com|8654865874',
     'ravi|ravi@gmail.com|8854865874',
     'raju|raju@gmail.com|8859865874',
     'ramaya|ramaya@gmail.com|9859865874',
     'hema|hema@gmail.com|9959865874',
     'pravali|ravali@gmail.com|959865874',
     'preeti|preeti@gmail.com|9959865874',
     'siri|siri@gmail.com|9959865874',
    ].forEach(row => {
      const [name, email, phone] = row.split('|');
      this.insert_user(name, email, phone);
    });

    // Companies
    [['TCS','Hyderabad','IT'],['Infosys','Bangalore','IT'],['Wipro','Chennai','IT'],
     ['HCL','Pune','IT'],['Tech Mahindra','Mumbai','IT'],['Accenture','Delhi','Consulting']
    ].forEach(([n,l,i]) => this.insert_company(n,l,i));

    // Jobs
    [[1,'Software Engineer',600000],[2,'Java Developer',700000],
     [3,'Python Developer',650000],[4,'Data Analyst',580000],
     [5,'DevOps Engineer',750000],[6,'UI/UX Designer',620000],
    ].forEach(([c,t,p]) => this.insert_job(c,t,p));

    // Applications
    const today = new Date().toISOString().split('T')[0];
    this.add_application(1,1,'2026-06-13','Rejected','Experience required');
    this.add_application(2,2,'2026-06-22','Rejected','Low Coding Score');
    this.add_application(3,3,'2026-06-11','Selected',null);
    this.add_application(4,4,'2026-05-11','Applied',null);
    this.add_application(5,5,'2026-06-17','Selected',null);
    this.add_application(6,6,'2026-05-19','Selected',null);
    this.add_application(7,1,'2026-05-01','Applied',null);
    this.add_application(8,2,'2026-06-29','Selected',null);
    this.add_application(9,3,'2026-06-17','Rejected','Experience required');
    this.add_application(10,4,'2026-06-19','Selected',null);

    // Interview Status
    [[1,'Selected'],[2,'Rejected'],[3,'Selected'],[4,'Pending'],[5,'Rejected']].forEach(
      ([rid,st]) => {
        const round = this.interview_rounds[rid-1];
        if(round) this.add_interview_status(round.round_id, st);
      }
    );
  },

  reset() {
    Object.keys(this._counters).forEach(k => this._counters[k] = 0);
    ['users','companies','jobs','applications','interview_rounds','interview_status','offers','rejection','sqlLog','triggerLog']
      .forEach(t => this[t] = []);
    this.seed();
  }
};
