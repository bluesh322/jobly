const { BadRequestError } = require("../expressError");
const {sqlForPartialUpdate} = require("./sql");

describe("partial update helper function", () => {
  test("works: dataToUpdate is provided", () => {
    const dataToUpdate = {
        firstName: "test",
        lastName: "test",
    };
    const jsToSql = {
      firstName: "first_name",
      lastName: "last_name",
      isAdmin: "is_admin",
    };

    result = sqlForPartialUpdate(dataToUpdate, jsToSql);

    expect(result).toEqual({
      setCols: "\"first_name\"=$1, \"last_name\"=$2",
      values: [
          "test",
          "test",
      ],
    });
  });

  test("fails: dataToUpdate is not provided", () => {
    const dataToUpdate = {};
    const jsToSql = {
      firstName: "first_name",
      lastName: "last_name",
      isAdmin: "is_admin",
    };
    try {
    result = sqlForPartialUpdate(dataToUpdate, jsToSql);
    fail();
    } catch (err) {
    expect(err instanceof BadRequestError).toBeTruthy();
    }
  });
});
