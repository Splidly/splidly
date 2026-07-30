ALTER TABLE "expense_group" ADD COLUMN "color" text;

UPDATE "expense_group"
SET "color" = (
  ARRAY[
    '#4745B8', '#1764B0', '#00749A', '#087867',
    '#237A43', '#5D761E', '#8A6500', '#A65300',
    '#B0442D', '#B7373C', '#A93668', '#923F83',
    '#7142AE', '#5E4DB3', '#7A5634', '#526675'
  ]
)[1 + (get_byte(decode(md5("id"::text), 'hex'), 0) % 16)];

ALTER TABLE "expense_group" ALTER COLUMN "color" SET DEFAULT '#4745B8';
ALTER TABLE "expense_group" ALTER COLUMN "color" SET NOT NULL;
