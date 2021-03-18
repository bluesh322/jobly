"use strict";

const db = require("../db");
const bcrypt = require("bcrypt");
const { sqlForPartialUpdate } = require("../helpers/sql");
const {
  NotFoundError,
  BadRequestError,
  UnauthorizedError,
} = require("../expressError");

const { BCRYPT_WORK_FACTOR } = require("../config.js");

/** Related functions for jobs. */

class Job {
  /** Create a job posting, update db, return the new job data.
   *
   * @param {title, salary, equity, company_handle}
   * @returns {id, title, salary, equity, company_handle}
   *
   * Throws BadRequestError if job already in database for same company.
   */

  static async create({ title, salary, equity, company_handle }) {
    const duplicateCheck = await db.query(
      `SELECT title
            FROM jobs
            WHERE title = $1 AND company_handle = $2`,
      [title, company_handle]
    );
    if (duplicateCheck.rows[0])
    throw new BadRequestError(
      `Duplicate job: ${title} at company: ${company_handle}`
    );

    const result = await db.query(
      `INSERT INTO jobs
            (title, salary, equity, company_handle)
            VALUES ($1, $2, $3, $4)
            RETURNING id, title, salary, equity, company_handle`,
      [title, salary, equity, company_handle]
    );
    const job = result.rows[0];

    return job;
  }

  /** Find all jobs or filter by name, minSalary, and hasEquity
   *
   * depending on which filter provided, a different SQL query will be called.
   *
   * @param query req.query
   * @returns [{id, title, salary, company_handle}, ...]
   */

  static async findAll(query) {
    const { title, minSalary } = query;
    let {hasEquity} = query;
    if (hasEquity === undefined) hasEquity = false; //normalize hasEquity for decision tree.
    if (typeof hasEquity !== "boolean") throw new BadRequestError(`hasEquity can only be boolean or undefined`);
    let jobsRes;

    if (title && !minSalary && hasEquity === false) {
      jobsRes = await Job.findAllByTitle(title);
    } else if (title && minSalary && hasEquity === false) {
      jobsRes = await Job.findAllByTitleAndMinSalary(title, minSalary);
    } else if (title && !minSalary && hasEquity) {
      jobsRes = await Job.findAllByTitleAndEquity(title);
    } else if (title && minSalary && hasEquity) {
      jobsRes = await Job.findAllByTitleMinSalaryEquity(title, minSalary);
    } else if (!title && minSalary && hasEquity === false) {
      jobsRes = await Job.findAllByMinSalary(minSalary);
    } else if (!title && minSalary && hasEquity) {
      jobsRes = await Job.findAllByMinSalaryAndEquity(minSalary);
    } else if (!title && !minSalary && hasEquity) {
      jobsRes = await Job.findAllByEquity();
    } else {
      jobsRes = await db.query(
        `SELECT id,
                  title,
                  salary,
                  equity,
                  company_handle
           FROM jobs
           ORDER BY title`
      );
    }
    return jobsRes.rows;
  }

  /** Find all jobs by title
   *
   * Returns [{id, title, salary, company_handle}, ...]
   */

  static async findAllByTitle(title) {
    return await db.query(
      `SELECT id,
              title,
              salary,
              equity,
              company_handle
           FROM jobs
           WHERE title ILIKE $1
           ORDER BY title`,
      [`%${title}%`]
    );
  }

  /** Find all companies by title and minSalary
   *
   * Returns [{id, title, salary, company_handle}, ...]
   */

  static async findAllByTitleAndMinSalary(title, minSalary) {
    return await db.query(
      `SELECT id,
                title,
                salary,
                equity,
                company_handle
             FROM jobs
             WHERE title ILIKE $1 AND salary >= $2
             ORDER BY title`,
      [`%${title}%`, minSalary]
    );
  }

  /** Find all companies by title, minSalary, and Equity
   *
   * Returns [{id, title, salary, company_handle}, ...]
   */

  static async findAllByTitleAndEquity(title) {
    return await db.query(
      `SELECT id,
                    title,
                    salary,
                    equity,
                    company_handle
                 FROM jobs
                 WHERE title ILIKE $1 AND equity > 0
                 ORDER BY title`,
      [`%${title}%`]
    );
  }

  /** Find all companies by title, minSalary, and Equity
   *
   * Returns [{id, title, salary, company_handle}, ...]
   */

  static async findAllByTitleMinSalaryEquity(title, minSalary) {
    return await db.query(
      `SELECT id,
                  title,
                  salary,
                  equity,
                  company_handle
               FROM jobs
               WHERE title ILIKE $1 AND salary >= $2 AND equity > 0
               ORDER BY title`,
      [`%${title}%`, minSalary]
    );
  }

  /** Find all companies by minSalary
   *
   * Returns [{id, title, salary, company_handle}, ...]
   */

  static async findAllByMinSalary(minSalary) {
    return await db.query(
      `SELECT id,
              title,
              salary,
              equity,
              company_handle
      FROM jobs
      WHERE salary >= $1
      ORDER BY title`,
      [minSalary]
    );
  }

  /** Find all companies by minSalary, and equity
   *
   * Returns [{id, title, salary, company_handle}, ...]
   */

  static async findAllByMinSalaryAndEquity(minSalary) {
    return await db.query(
      `SELECT id,
              title,
              salary,
              equity,
              company_handle
      FROM jobs
      WHERE salary >= $1 AND equity > 0
      ORDER BY title`,
      [minSalary]
    );
  }

  /** Find all companies by equity
   *
   * Returns [{id, title, salary, company_handle}, ...]
   */

  static async findAllByEquity() {
    return await db.query(
      `SELECT id,
              title,
              salary,
              equity,
              company_handle
      FROM jobs
      WHERE equity > 0
      ORDER BY title`
    );
  }

  /** Given a job id, return data about a job at that company
   *
   * Returns { id, title, salary, equity, company_handle}
   *   where company is [{id, name, description, numEmployees, logoUrl, jobs} ...]
   *
   * Throws NotFoundError if not found
   */

  static async get(id) {
    const jobsRes = await db.query(
      `SELECT id,
              title,
              salary,
              equity,
              company_handle
        FROM jobs
        WHERE id = $1`,
      [id]
    );

    const job = jobsRes.rows[0];

    if (!job) throw new NotFoundError(`No job: ${id}`);

    return job;
  }

  /** Update job data with 'data'.
   *
   * This is a "partial update" --- it's fine if data doesn't contain all the
   * fields; this only changes provided ones.
   *
   * Data can include: {id, title, salary, equity, company_handle}
   *
   * Returns {id, title, salary, equity, company_handle}
   *
   * Throws NotFoundError if not found.
   */

  static async update(id, data) {
    const { setCols, values } = sqlForPartialUpdate(data, {
      companyHandle: "company_handle"
    });
    const idVarIdx = `$${values.length + 1}`;

    const querySql = `UPDATE jobs
                        SET ${setCols}
                        WHERE id = ${idVarIdx}
                        RETURNING id,
                                title,
                                salary,
                                equity,
                                company_handle`;
    const result = await db.query(querySql, [...values, id]);
    const job = result.rows[0];

    if (!job) throw new NotFoundError(`No job: ${id}`);

    return job;
  }

  /** Delete given job from database, return undefined.
   *
   * Throws NotFound if job not found.
   *
   */

  static async remove(id) {
    const result = await db.query(
      `DELETE
          FROM jobs
          WHERE id = $1
          RETURNING id`,
          [id]
    );
    const job = result.rows[0];

    if (!job) throw new NotFoundError(`No job: ${id}`);
  }
}

module.exports = Job;
