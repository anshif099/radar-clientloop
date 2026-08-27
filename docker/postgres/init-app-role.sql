create role clientloop login password 'clientloop' nosuperuser nocreatedb nocreaterole noinherit;
alter database clientloop owner to clientloop;
grant all on schema public to clientloop;
