"use strict";

const request = require("supertest");

const db = require("../db");
const app = require("../app");

const {
  commonBeforeAll,
  commonBeforeEach,
  commonAfterEach,
  commonAfterAll,
  u1Token, //is_admin = True
  u2Token, //is_admin = False
} = require("./_testCommon");

const { BadRequestError } = require("../expressError");

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

/************************************** POST /jobs */

describe("POST /jobs", function () {
  const newJob = {
    title: "test",
    salary: 10,
    equity: "0",
    company_handle: "c1",
  };

  test("ok for admins", async function () {
    const resp = await request(app)
      .post("/jobs")
      .send(newJob)
      .set("authorization", `Bearer ${u1Token}`);
    expect(resp.statusCode).toEqual(201);
    expect(resp.body).toEqual({
      job: newJobResult,
    });
  });

  test("fails: unauth for users", async function () {
    const resp = await request(app)
      .post(`/jobs`)
      .send(newJob)
      .set("authorization", `Bearer ${u2Token}`);
    expect(resp.statusCode).toEqual(401);
  });

  test("bad request with missing data", async function () {
    const resp = await request(app)
      .post("/jobs")
      .send({
        title: "new",
        salary: 10,
      })
      .set("authorization", `Bearer ${u1Token}`);
    expect(resp.statusCode).toEqual(400);
  });

  test("bad request with invalid data", async function () {
    const resp = await request(app)
      .post("/jobs")
      .send({
        ...newJob,
        logoUrl: "not-a-url",
      })
      .set("authorization", `Bearer ${u1Token}`);
    expect(resp.statusCode).toEqual(400);
  });
});

/************************************** GET /jobs */

describe("GET /jobs", function () {
  test("ok for anon", async function () {
    const resp = await request(app).get("/jobs");
    expect(resp.body).toEqual({
      jobs: [
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
      ],
    });
  });

  test("fail:  hasEquity is not undefined or boolean", async () => {
    const resp = await request(app).get("/jobs/?hasEquity=bad");
    expect(resp.statusCode).toEqual(400);
  });

  test("fails: test next() idr", async function () {
    // there's no normal failure event which will cause this route to fail ---
    // thus making it hard to test that the error-idr works with it. This
    // should cause an error, all right :)
    await db.query("DROP TABLE jobs CASCADE");
    const resp = await request(app)
      .get("/jobs")
      .set("authorization", `Bearer ${u1Token}`);
    expect(resp.statusCode).toEqual(500);
  });
});

/************************************** GET /jobs/:id */

describe("GET /jobs/:id", function () {
  test("works for anon", async function () {
    const res = await db.query(`SELECT id FROM jobs WHERE title = 'j1'`);
    const resp = await request(app).get(`/jobs/${res.rows[0].id}`);
    expect(resp.body).toEqual({
      job: {
        id: res.rows[0].id,
        title: "j1",
        salary: 70000,
        equity: "0",
        company_handle: "c1",
      },
    });
  });

  test("not found for no such company", async function () {
    const resp = await request(app).get(`/jobs/0`);
    expect(resp.statusCode).toEqual(404);
  });
});

/************************************** PATCH /jobs/:id */

describe("PATCH /jobs/:id", function () {
  test("works for admin", async function () {
    const res = await db.query(`SELECT id FROM jobs WHERE title = 'j1'`);
    const resp = await request(app)
      .patch(`/jobs/${res.rows[0].id}`)
      .send({
        title: "j1-new",
      })
      .set("authorization", `Bearer ${u1Token}`);
    expect(resp.body).toEqual({
      job: {
        id: res.rows[0].id,
        title: "j1-new",
        salary: 70000,
        equity: "0",
        company_handle: "c1",
      },
    });
  });

  test("fails: unauth for users", async function () {
    const res = await db.query(`SELECT id FROM jobs WHERE title = 'j1'`);
    const resp = await request(app)
      .patch(`/jobs/${res.rows[0].id}`)
      .send({
        title: "C1-new",
      })
      .set("authorization", `Bearer ${u2Token}`);
    expect(resp.statusCode).toEqual(401);
  });

  test("unauth for anon", async function () {
    const res = await db.query(`SELECT id FROM jobs WHERE title = 'j1'`);
    const resp = await request(app).patch(`/jobs/${res.rows[0].id}`).send({
      title: "C1-new",
    });
    expect(resp.statusCode).toEqual(401);
  });

  test("not found on no such company", async function () {
    const resp = await request(app)
      .patch(`/jobs/0`)
      .send({
        title: "new nope",
      })
      .set("authorization", `Bearer ${u1Token}`);
    expect(resp.statusCode).toEqual(404);
  });

  test("bad request on id change attempt", async function () {
    const res = await db.query(`SELECT id FROM jobs WHERE title = 'j1'`);
    const resp = await request(app)
      .patch(`/jobs/${res.rows[0].id}`)
      .send({
        id: "22",
      })
      .set("authorization", `Bearer ${u1Token}`);
    expect(resp.statusCode).toEqual(400);
  });

  test("bad request on invalid data", async function () {
    const res = await db.query(`SELECT id FROM jobs WHERE title = 'j1'`);
    const resp = await request(app)
      .patch(`/jobs/${res.rows[0].id}`)
      .send({
        something: "else",
      })
      .set("authorization", `Bearer ${u1Token}`);
    expect(resp.statusCode).toEqual(400);
  });
});

/************************************** DELETE /jobs/:id */

describe("DELETE /jobs/:id", function () {
  test("works for admin", async function () {
    const res = await db.query(`SELECT id FROM jobs WHERE title = 'j1'`);
    const resp = await request(app)
      .delete(`/jobs/${res.rows[0].id}`)
      .set("authorization", `Bearer ${u1Token}`);
    expect(resp.body).toEqual({ deleted: `${res.rows[0].id}` });
  });

  test("fails: unauth for users", async function () {
    const res = await db.query(`SELECT id FROM jobs WHERE title = 'j1'`);
    const resp = await request(app)
      .delete(`/jobs/${res.rows[0].id}`)
      .set("authorization", `Bearer ${u2Token}`);
    expect(resp.statusCode).toEqual(401);
  });

  test("unauth for anon", async function () {
    const resp = await request(app).delete(`/jobs/2`);
    expect(resp.statusCode).toEqual(401);
  });

  test("not found for no such company", async function () {
    const resp = await request(app)
      .delete(`/jobs/0`)
      .set("authorization", `Bearer ${u1Token}`);
    expect(resp.statusCode).toEqual(404);
  });
});
