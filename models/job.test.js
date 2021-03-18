"use strict";

const db = require("../db.js");
const { BadRequestError, NotFoundError } = require("../expressError");
const Job = require("./job.js");
const {
  commonBeforeAll,
  commonBeforeEach,
  commonAfterEach,
  commonAfterAll,
} = require("./_testCommon");

beforeAll(commonBeforeAll);
beforeEach(commonBeforeEach);
afterEach(commonAfterEach);
afterAll(commonAfterAll);

const newJobResult = {
  id: expect.any(Number),
  title: "test",
  salary: 10,
  equity: "0",
  company_handle: "c1",
};

/************************************** create */

describe("create", function () {
  const newJob = {
    title: "test",
    salary: 10,
    equity: "0",
    company_handle: "c1",
  };

  test("works", async function () {
    let job = await Job.create(newJob);
    expect(job).toEqual(newJobResult);

    const result = await db.query(
      `SELECT id,
            title,
            salary,
            equity,
            company_handle
        FROM jobs
        WHERE title = 'test'`
    );
    expect(result.rows).toEqual([
      {
        id: expect.any(Number),
        title: "test",
        salary: 10,
        equity: "0",
        company_handle: "c1",
      },
    ]);
  });

  test("bad request with dupe", async function () {
    try {
      await Job.create(newJob);
      await Job.create(newJob);
      fail();
    } catch (err) {
      expect(err instanceof BadRequestError).toBeTruthy();
    }
  });
});

/************************************** findAll */

describe("findAll", function () {
  test("works: no filter", async function () {
    let query = "";
    let jobs = await Job.findAll(query);
    expect(jobs).toEqual([
      {
        id: expect.any(Number),
        title: "j1",
        salary: 70000,
        equity: "0",
        company_handle: "c1",
      },
      {
        id: expect.any(Number),
        title: "j2",
        salary: 100000,
        equity: "0.5",
        company_handle: "c2",
      },
      {
        id: expect.any(Number),
        title: "j3",
        salary: 150000,
        equity: "0",
        company_handle: "c3",
      },
    ]);
  });

  test("works: filter by title only", async () => {
    let query = { title: "j1" };
    let jobs = await Job.findAll(query);
    expect(jobs).toEqual([
      {
        id: expect.any(Number),
        title: "j1",
        salary: 70000,
        equity: "0",
        company_handle: "c1",
      },
    ]);
  });

  test("works: filter by title and minSalary only", async () => {
    let query = { title: "j3", minSalary: 120000 };
    let jobs = await Job.findAll(query);
    expect(jobs).toEqual([
      {
        id: expect.any(Number),
        title: "j3",
        salary: 150000,
        equity: "0",
        company_handle: "c3",
      },
    ]);
  });

  test("works: filter by title, minSalary, and Equity", async () => {
    let query = { title: "j2", minSalary: 90000, hasEquity: true };
    let jobs = await Job.findAll(query);
    expect(jobs).toEqual([
      {
        id: expect.any(Number),
        title: "j2",
        salary: 100000,
        equity: "0.5",
        company_handle: "c2",
      },
    ]);
  });

  test("works: filter by title and equity only", async () => {
    let query = { title: "j2", hasEquity: true };
    let jobs = await Job.findAll(query);
    expect(jobs).toEqual([
      {
        id: expect.any(Number),
        title: "j2",
        salary: 100000,
        equity: "0.5",
        company_handle: "c2",
      },
    ]);
  });

  test("works: filter by minSalary only", async () => {
    let query = { minSalary: 90000 };
    let jobs = await Job.findAll(query);
    expect(jobs).toEqual([
      {
        id: expect.any(Number),
        title: "j2",
        salary: 100000,
        equity: "0.5",
        company_handle: "c2",
      },
      {
        id: expect.any(Number),
        title: "j3",
        salary: 150000,
        equity: "0",
        company_handle: "c3",
      },
    ]);
  });

  test("works: filter by minSalary and equity only", async () => {
    let query = { minSalary: 90000, hasEquity: true };
    let jobs = await Job.findAll(query);
    expect(jobs).toEqual([
      {
        id: expect.any(Number),
        title: "j2",
        salary: 100000,
        equity: "0.5",
        company_handle: "c2",
      },
    ]);
  });

  test("works: filter by equity only", async () => {
    let query = { hasEquity: true };
    let jobs = await Job.findAll(query);
    expect(jobs).toEqual([
      {
        id: expect.any(Number),
        title: "j2",
        salary: 100000,
        equity: "0.5",
        company_handle: "c2",
      },
    ]);
  });

  test("fails: equity is not boolean", async () => {
    let query = { hasEquity: "dog" };

    try {
      await Job.findAll(query);
      fail();
    } catch (err) {
      expect(err instanceof BadRequestError).toBeTruthy();
    }
  });
});

/************************************** get */

describe("get", function () {
  test("works", async function () {
    const res = await db.query(`SELECT id FROM jobs WHERE title = 'j1'`);
    let job = await Job.get(res.rows[0].id);
    expect(job).toEqual({
      id: expect.any(Number),
      title: "j1",
      salary: 70000,
      equity: "0",
      company_handle: "c1",
    });
  });

  test("not found if no such job", async function () {
    try {
      await Job.get("0");
      fail();
    } catch (err) {
      expect(err instanceof NotFoundError).toBeTruthy();
    }
  });
});

/************************************** update */

describe("update", function () {
  const updateData = {
    title: "new",
    salary: 10,
    equity: "0.4",
    company_handle: "c1",
  };

  test("works", async function () {
    const res = await db.query(`SELECT id FROM jobs WHERE title = 'j1'`);
    let job = await Job.update(res.rows[0].id, updateData);
    expect(job).toEqual({
      id: res.rows[0].id,
      ...updateData,
    });

    const result = await db.query(
      `SELECT id, title, salary, equity, company_handle
             FROM jobs
             WHERE id = $1`,
      [res.rows[0].id]
    );
    expect(result.rows).toEqual([
      {
        id: res.rows[0].id,
        title: "new",
        salary: 10,
        equity: "0.4",
        company_handle: "c1",
      },
    ]);
  });

  test("works: null fields", async function () {
    const res = await db.query(`SELECT id FROM jobs WHERE title = 'j1'`);
    const updateDataSetNulls = {
      title: "New",
      salary: null,
      equity: null,
      company_handle: "c1",
    };

    let job = await Job.update(res.rows[0].id, updateDataSetNulls);
    expect(job).toEqual({
      id: res.rows[0].id,
      ...updateDataSetNulls,
    });

    const result = await db.query(
      `SELECT id, title, salary, equity, company_handle
           FROM jobs
           WHERE id = $1`,
      [res.rows[0].id]
    );
    expect(result.rows).toEqual([
      {
        id: res.rows[0].id,
        title: "New",
        salary: null,
        equity: null,
        company_handle: "c1",
      },
    ]);
  });

  test("not found if no such job", async function () {
    try {
      await Job.update(0, updateData);
      fail();
    } catch (err) {
      expect(err instanceof NotFoundError).toBeTruthy();
    }
  });

  test("bad request with no data", async function () {
    try {
      const res = await db.query(`SELECT id FROM jobs WHERE title = 'j1'`);
      await Job.update(res.rows[0].id, {});
      fail();
    } catch (err) {
      expect(err instanceof BadRequestError).toBeTruthy();
    }
  });
});

/************************************** remove */

describe("remove", function () {
  test("works", async function () {
    const res = await db.query(`SELECT id FROM jobs WHERE title = 'j1'`);
    await Job.remove(res.rows[0].id);
    const result = await db.query("SELECT id FROM jobs WHERE title='j1'");
    expect(result.rows.length).toEqual(0);
  });

  test("not found if no such company", async function () {
    try {
      await Job.remove(0);
      fail();
    } catch (err) {
      expect(err instanceof NotFoundError).toBeTruthy();
    }
  });
});
