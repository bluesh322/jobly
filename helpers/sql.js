const { BadRequestError } = require("../expressError");

/** sqlForPartialUpdate: A pattern matching function for updating columns in a table with potentially partial data.
 * 
 *  Parameters: (dataToUpdate, jsToSql) =>
 *  Returns: {setCols: "values in SET() of UPDATE", values: "parameters to be provided to UPDATE query"} 
 *  
 *  Throws BadRequestError if no dataToUpdate provied.
 * */

function sqlForPartialUpdate(dataToUpdate, jsToSql) {
  const keys = Object.keys(dataToUpdate);
  if (keys.length === 0) throw new BadRequestError("No data");

  // {firstName: 'Aliya', age: 32} => ['"first_name"=$1', '"age"=$2']
  const cols = keys.map((colName, idx) =>
      `"${jsToSql[colName] || colName}"=$${idx + 1}`,
  );

  return {
    setCols: cols.join(", "),
    values: Object.values(dataToUpdate),
  };
}

module.exports = { sqlForPartialUpdate };
