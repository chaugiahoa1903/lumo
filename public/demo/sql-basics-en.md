# SQL basics

SQL (Structured Query Language) is the standard language for querying and managing data in relational databases. Data lives in tables made of rows (records) and columns (attributes). Analysts use SQL every day to pull numbers, check data quality, and prepare tables for analysis.

## The SELECT statement

SELECT chooses which columns to read from a table. The basic form is SELECT column_name FROM table_name. An asterisk returns every column, but in real work it is better to list the columns you need, which keeps queries fast and readable. The DISTINCT keyword removes duplicate values from the result.

## Filtering with WHERE

The WHERE clause keeps only the rows that meet a condition. Conditions use comparison operators and combine with AND, OR, and NOT. IN tests membership in a list, BETWEEN tests a range, and LIKE matches text patterns. Missing values must be tested with IS NULL, never with an equals sign.

## Sorting and limiting results

ORDER BY sorts the result by one or more columns, ascending (ASC) or descending (DESC). When you only need the first few rows, use LIMIT or TOP, depending on the database system. Sorting is often combined with a limit to find the largest or smallest values quickly.

## Combining tables with JOIN

Real data is usually spread across several tables, so JOIN links them through a shared key. INNER JOIN keeps only rows that match in both tables. LEFT JOIN keeps every row from the left table, and unmatched rows get NULL on the right side. When joining many tables, give each one an alias to keep queries short and avoid ambiguous column names.

## Aggregating with GROUP BY

GROUP BY collects rows with the same value into groups, then applies aggregate functions such as COUNT, SUM, AVG, MIN, and MAX to each group. Conditions on aggregated results belong in HAVING, because WHERE only filters rows before grouping. Knowing the logical order of execution, FROM, WHERE, GROUP BY, HAVING, SELECT, ORDER BY, prevents many common mistakes.