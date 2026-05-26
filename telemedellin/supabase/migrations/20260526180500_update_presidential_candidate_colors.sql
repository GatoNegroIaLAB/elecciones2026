update public.pr_catalog_parties
set color_hex = colors.color_hex,
    updated_at = now()
from (
  values
    ('00026', '#6B2D8B'),
    ('01004', '#2A7A4A'),
    ('01001', '#D4A017'),
    ('01003', '#1E4D8C'),
    ('03001', '#2C6FA8'),
    ('00020', '#C0252A'),
    ('01002', '#B02020'),
    ('00022', '#C06040'),
    ('01006', '#1E6A98'),
    ('00021', '#5A7A3A'),
    ('00009', '#1A3A6B'),
    ('00015', '#4A9A5A'),
    ('01005', '#3A8A6A')
) as colors(codigo, color_hex)
where public.pr_catalog_parties.codigo = colors.codigo;
