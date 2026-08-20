import os
import glob
import sys
import tkinter as tk
from tkinter import filedialog, messagebox, ttk
from typing import List, Tuple, Dict
import pandas as pd

class ConcentradorSISApp:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("SIREVAQ — Concentrador e Inspector Inteligente SIS")
        self.root.geometry("780x640")
        self.root.minsize(700, 540)

        # Configurar colores y estilos ejecutivos
        self.bg_color = "#f8fafc"
        self.card_bg = "#ffffff"
        self.primary_color = "#0f172a"
        self.accent_color = "#0d9488"
        self.border_color = "#cbd5e1"
        
        self.root.configure(bg=self.bg_color)
        
        # Variables de control Tkinter
        self.var_origen = tk.StringVar(value="")
        self.var_destino = tk.StringVar(value="")
        self.var_hoja = tk.StringVar(value="CSV")
        self.var_auto_zero = tk.BooleanVar(value=True)

        self._crear_interfaz()

    def _crear_interfaz(self):
        # Header principal
        header_frame = tk.Frame(self.root, bg=self.primary_color, height=75)
        header_frame.pack(fill="x", side="top")
        
        lbl_title = tk.Label(
            header_frame, 
            text="SIREVAQ — Concentrador & Diagnóstico SIS", 
            font=("Segoe UI", 15, "bold"), 
            fg="#ffffff", 
            bg=self.primary_color,
            anchor="w",
            padx=20,
            pady=10
        )
        lbl_title.pack(fill="x")
        
        lbl_subtitle = tk.Label(
            header_frame, 
            text="Consolidación masiva de archivos mensuales de vacunación con diagnóstico de salud de datos", 
            font=("Segoe UI", 9), 
            fg="#94a3b8", 
            bg=self.primary_color,
            anchor="w",
            padx=20
        )
        lbl_subtitle.pack(fill="x")

        # Contenedor Central
        main_frame = tk.Frame(self.root, bg=self.bg_color, padx=20, pady=15)
        main_frame.pack(fill="both", expand=True)

        # Seccion 1: Selección de Origen y Destino
        config_frame = tk.LabelFrame(
            main_frame, 
            text=" Configuración de Rutas de Trabajo ", 
            font=("Segoe UI", 10, "bold"), 
            fg=self.primary_color, 
            bg=self.card_bg,
            bd=1,
            relief="solid",
            padx=15,
            pady=15
        )
        config_frame.pack(fill="x", pady=(0, 15))

        # Fila Origen
        grid_origen = tk.Frame(config_frame, bg=self.card_bg)
        grid_origen.pack(fill="x", pady=4)
        tk.Label(grid_origen, text="Carpeta de Archivos (.xlsx):", font=("Segoe UI", 9, "bold"), width=22, anchor="w", bg=self.card_bg, fg="#334155").pack(side="left")
        tk.Entry(grid_origen, textvariable=self.var_origen, font=("Segoe UI", 9), bg="#f1f5f9", bd=1, relief="solid").pack(side="left", fill="x", expand=True, padx=5)
        tk.Button(grid_origen, text="Seleccionar Carpeta", font=("Segoe UI", 9, "bold"), bg="#e2e8f0", fg="#0f172a", relief="flat", command=self._seleccionar_origen, cursor="hand2").pack(side="right")

        # Fila Destino
        grid_destino = tk.Frame(config_frame, bg=self.card_bg)
        grid_destino.pack(fill="x", pady=4)
        tk.Label(grid_destino, text="Archivo CSV Concentrado:", font=("Segoe UI", 9, "bold"), width=22, anchor="w", bg=self.card_bg, fg="#334155").pack(side="left")
        tk.Entry(grid_destino, textvariable=self.var_destino, font=("Segoe UI", 9), bg="#f1f5f9", bd=1, relief="solid").pack(side="left", fill="x", expand=True, padx=5)
        tk.Button(grid_destino, text="Guardar Como...", font=("Segoe UI", 9, "bold"), bg="#e2e8f0", fg="#0f172a", relief="flat", command=self._seleccionar_destino, cursor="hand2").pack(side="right")

        # Opciones avanzadas
        opts_frame = tk.Frame(config_frame, bg=self.card_bg)
        opts_frame.pack(fill="x", pady=(8, 0))
        
        tk.Label(opts_frame, text="Hoja objetivo:", font=("Segoe UI", 9), bg=self.card_bg, fg="#475569").pack(side="left")
        tk.Entry(opts_frame, textvariable=self.var_hoja, width=8, font=("Segoe UI", 9, "bold"), bg="#ffffff", bd=1, relief="solid").pack(side="left", padx=(5, 20))

        chk_zero = tk.Checkbutton(
            opts_frame, 
            text="Normalizar valores vacíos, comas o espacios como 0 de forma automática", 
            variable=self.var_auto_zero, 
            font=("Segoe UI", 9, "bold"), 
            bg=self.card_bg, 
            fg="#0d9488"
        )
        chk_zero.pack(side="left")

        # Botón Acción Principal
        btn_run = tk.Button(
            main_frame, 
            text="⚡ CONSOLIDAR Y EJECUTAR DIAGNÓSTICO", 
            font=("Segoe UI", 11, "bold"), 
            bg=self.accent_color, 
            fg="#ffffff", 
            activebackground="#0f766e", 
            activeforeground="#ffffff", 
            relief="flat", 
            pady=8,
            cursor="hand2",
            command=self._procesar_archivos
        )
        btn_run.pack(fill="x", pady=(0, 15))

        # Consola Log / Diagnóstico
        log_frame = tk.LabelFrame(
            main_frame, 
            text=" Diagnóstico de Compilación y Log en Tiempo Real ", 
            font=("Segoe UI", 10, "bold"), 
            fg=self.primary_color, 
            bg=self.card_bg,
            bd=1,
            relief="solid",
            padx=10,
            pady=10
        )
        log_frame.pack(fill="both", expand=True)

        self.txt_log = tk.Text(log_frame, font=("Consolas", 9), bg="#0f172a", fg="#f8fafc", wrap="none", bd=0)
        self.txt_log.pack(fill="both", expand=True, side="left")

        scrollbar_y = ttk.Scrollbar(log_frame, orient="vertical", command=self.txt_log.yview)
        scrollbar_y.pack(side="right", fill="y")
        self.txt_log.configure(yscrollcommand=scrollbar_y.set)

    def _seleccionar_origen(self):
        folder = filedialog.askdirectory(title="Selecciona la carpeta con los archivos Excel mensuales")
        if folder:
            self.var_origen.set(folder)
            if not self.var_destino.get():
                self.var_destino.set(os.path.join(folder, "concentrado_total_sis.csv"))

    def _seleccionar_destino(self):
        filepath = filedialog.asksaveasfilename(
            title="Guardar archivo concentrado como...",
            defaultextension=".csv",
            filetypes=[("Archivo CSV", "*.csv"), ("Todos los archivos", "*.*")]
        )
        if filepath:
            self.var_destino.set(filepath)

    def _log(self, text: str, tag: str = None):
        self.txt_log.insert(tk.END, text + "\n", tag)
        self.txt_log.see(tk.END)
        self.root.update_idletasks()

    def _procesar_archivos(self):
        origen = self.var_origen.get().strip()
        destino = self.var_destino.get().strip()
        hoja_target = self.var_hoja.get().strip() or "CSV"

        if not origen or not os.path.exists(origen):
            messagebox.showerror("Ruta Inválida", "Por favor selecciona una carpeta de origen válida.")
            return

        if not destino:
            messagebox.showerror("Ruta Inválida", "Por favor especifica el archivo de salida .csv")
            return

        self.txt_log.delete("1.0", tk.END)
        self._log("==========================================================")
        self._log(" 🚀 INICIANDO PROCESO DE CONSOLIDACIÓN Y DIAGNÓSTICO SIS")
        self._log("==========================================================")
        self._log(f"📍 Carpeta Origen : {origen}")
        self._log(f"📍 Archivo Salida : {destino}")
        self._log(f"📄 Hoja Objetivo   : '{hoja_target}'\n")

        archivos = glob.glob(os.path.join(origen, "*.xlsx"))
        if not archivos:
            self._log("❌ ERROR: No se encontraron archivos .xlsx en la carpeta de origen.")
            messagebox.showwarning("Sin archivos", "No se encontraron archivos .xlsx en la carpeta seleccionada.")
            return

        self._log(f"📦 Archivos detectados: {len(archivos)}\n")

        lista_dfs = []
        diagnostico = {
            "archivos_procesados": 0,
            "archivos_omitidos": 0,
            "espacios_vacios_normalizados": 0,
            "duplicados_removidos": 0,
            "errores_sintaxis": []
        }

        for idx, archivo in enumerate(archivos, 1):
            base_name = os.path.basename(archivo)
            self._log(f"[{idx}/{len(archivos)}] Procesando: {base_name} ...")

            try:
                # Leer hoja objetivo
                df = pd.read_excel(archivo, sheet_name=hoja_target)

                # Limpieza de nombres de columna
                df.columns = df.columns.astype(str).str.strip().str.upper()

                # Eliminar columnas irrelevantes / Unnamed
                valid_cols = [c for c in df.columns if not c.startswith('UNNAMED')]
                df = df[valid_cols]

                # Renombrar variaciones comunes de columnas clave
                if 'VARIABLE' in df.columns and 'VARIABLE_SIS' not in df.columns:
                    df.rename(columns={'VARIABLE': 'VARIABLE_SIS'}, inplace=True)
                if 'VALOR' not in df.columns and 'DOSIS' in df.columns:
                    df.rename(columns={'DOSIS': 'VALOR'}, inplace=True)
                if 'AÑO' in df.columns and 'ANIO' not in df.columns:
                    df.rename(columns={'AÑO': 'ANIO'}, inplace=True)

                # Normalización inteligente de valores (espacios vacíos, comas, etc -> 0)
                if 'VALOR' in df.columns and self.var_auto_zero.get():
                    val_orig = df['VALOR'].copy()
                    # Reemplazar cadenas vacías o compuestas por solo espacios por '0'
                    df['VALOR'] = df['VALOR'].astype(str).str.strip()
                    df['VALOR'] = df['VALOR'].replace({'': '0', 'nan': '0', 'None': '0', 'null': '0'})
                    # Convertir a entero numérico forzando errores a 0
                    df['VALOR'] = pd.to_numeric(df['VALOR'], errors='coerce').fillna(0).astype(int)
                    
                    vacios_count = (val_orig.astype(str).str.strip() == '').sum()
                    diagnostico["espacios_vacios_normalizados"] += vacios_count

                # Preservar orden original dentro del archivo
                df['ORDEN_ORIGINAL'] = range(len(df))
                lista_dfs.append(df)
                diagnostico["archivos_procesados"] += 1
                self._log(f"   └─ ✅ OK: {len(df)} filas extraídas.")

            except ValueError:
                diagnostico["archivos_omitidos"] += 1
                self._log(f"   └─ ⚠️ ADVERTENCIA: No contiene la hoja '{hoja_target}'. Omitido.")
            except Exception as e:
                diagnostico["archivos_omitidos"] += 1
                diagnostico["errores_sintaxis"].append(f"{base_name}: {str(e)}")
                self._log(f"   └─ ❌ ERROR: {e}")

        if not lista_dfs:
            self._log("\n❌ No se extrajo ningún dato válido de los archivos proporcionados.")
            messagebox.showerror("Error", "No se extrajeron datos válidos.")
            return

        self._log("\n----------------------------------------------------------")
        self._log("⚙️ CONSOLIDANDO MATRIZ JURISDICCIONAL...")
        df_final = pd.concat(lista_dfs, ignore_index=True)

        # 1. Homologación de Municipios
        if 'MUNICIPIO' in df_final.columns:
            df_final['MUNICIPIO'] = df_final['MUNICIPIO'].astype(str).str.strip().str.upper()
            df_final['MUNICIPIO'] = df_final['MUNICIPIO'].replace({
                'EL MARQUÉS': 'MARQUÉS',
                'EL MARQUES': 'MARQUÉS',
                'MARQUES': 'MARQUÉS',
                'QUERETARO': 'QUERÉTARO'
            })
            orden_muni = ['QUERÉTARO', 'CORREGIDORA', 'MARQUÉS', 'HUIMILPAN']
            df_final['MUNICIPIO'] = pd.Categorical(df_final['MUNICIPIO'], categories=orden_muni, ordered=True)

        # 2. Conversión numérica de mes
        if 'MES' in df_final.columns:
            df_final['MES'] = pd.to_numeric(df_final['MES'], errors='coerce').fillna(1).astype(int)

        # 3. Deduplicación inteligente de seguridad
        cols_clave = [c for c in ['CLUES', 'VARIABLE_SIS', 'MES', 'ANIO'] if c in df_final.columns]
        filas_antes = len(df_final)
        if cols_clave:
            df_final = df_final.drop_duplicates(subset=cols_clave, keep='last')
        duplicados = filas_antes - len(df_final)
        diagnostico["duplicados_removidos"] = duplicados

        # 4. Ordenamiento estable Top-Down (Mes -> Municipio -> CLUES -> Orden)
        sort_cols = [c for c in ['MES', 'MUNICIPIO', 'CLUES', 'ORDEN_ORIGINAL'] if c in df_final.columns]
        df_final = df_final.sort_values(by=sort_cols, ascending=[True] * len(sort_cols), kind='mergesort')

        if 'ORDEN_ORIGINAL' in df_final.columns:
            df_final.drop(columns=['ORDEN_ORIGINAL'], inplace=True)

        # Exportar CSV final UTF-8 BOM para apertura perfecta en Excel
        try:
            df_final.to_csv(destino, index=False, encoding='utf-8-sig')
            self._log("\n==========================================================")
            self._log(" 🎉 ¡CONSOLIDACIÓN COMPLETADA CON ÉXITO!")
            self._log("==========================================================")
            self._log(f"📊 Registros totales consolidados : {len(df_final):,}")
            self._log(f"📁 Archivos procesados con éxito  : {diagnostico['archivos_procesados']}")
            self._log(f"🧹 Registros vacíos a '0'          : {diagnostico['espacios_vacios_normalizados']:,}")
            self._log(f"🛡️ Duplicados eliminados          : {diagnostico['duplicados_removidos']:,}")
            self._log(f"💾 Guardado en                   : {destino}\n")

            messagebox.showinfo(
                "¡Éxito!", 
                f"Consolidación exitosa.\n\n"
                f"• Registros totales: {len(df_final):,}\n"
                f"• Vacíos corregidos: {diagnostico['espacios_vacios_normalizados']:,}\n"
                f"• Archivo: {os.path.basename(destino)}"
            )

        except Exception as e:
            self._log(f"\n❌ Error al escribir el archivo final: {e}")
            messagebox.showerror("Error de Escritura", f"No se pudo guardar el archivo CSV:\n{e}")

if __name__ == "__main__":
    root = tk.Tk()
    app = ConcentradorSISApp(root)
    root.mainloop()
