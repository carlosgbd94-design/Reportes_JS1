-- Migración para añadir la columna sin_pedido a biologicos_pedido
ALTER TABLE public.biologicos_pedido ADD COLUMN IF NOT EXISTS sin_pedido BOOLEAN DEFAULT false;
