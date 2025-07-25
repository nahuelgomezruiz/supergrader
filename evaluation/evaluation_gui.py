import tkinter as tk
from tkinter import ttk, messagebox, filedialog
import threading
import asyncio
from pathlib import Path
import json
import os
from datetime import datetime
from evaluation_dashboard import (
    BackendClient, CSVParser, ExcelReportGenerator,
    evaluate_project, create_summary_report
)


class EvaluationGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("Grading Evaluation Dashboard")
        self.root.geometry("800x600")
        
        # Variables
        self.num_students_var = tk.IntVar(value=5)
        self.backend_url_var = tk.StringVar(value="http://localhost:8000")
        self.output_dir_var = tk.StringVar(value="evaluation_results")
        self.selected_projects = {}
        self.is_running = False
        
        self.create_widgets()
        self.load_projects()
        
    def create_widgets(self):
        """Create the GUI widgets."""
        
        # Title
        title_frame = ttk.Frame(self.root, padding="10")
        title_frame.grid(row=0, column=0, columnspan=2, sticky=(tk.W, tk.E))
        
        title_label = ttk.Label(
            title_frame,
            text="Grading Evaluation Dashboard",
            font=("Arial", 16, "bold")
        )
        title_label.pack()
        
        # Configuration Frame
        config_frame = ttk.LabelFrame(self.root, text="Configuration", padding="10")
        config_frame.grid(row=1, column=0, columnspan=2, sticky=(tk.W, tk.E), padx=10, pady=5)
        
        # Number of students
        ttk.Label(config_frame, text="Number of students per assignment:").grid(
            row=0, column=0, sticky=tk.W, pady=5
        )
        
        students_spinbox = ttk.Spinbox(
            config_frame,
            from_=1,
            to=200,
            textvariable=self.num_students_var,
            width=10
        )
        students_spinbox.grid(row=0, column=1, sticky=tk.W, padx=10)
        
        # Backend URL
        ttk.Label(config_frame, text="Backend URL:").grid(
            row=1, column=0, sticky=tk.W, pady=5
        )
        
        url_entry = ttk.Entry(config_frame, textvariable=self.backend_url_var, width=40)
        url_entry.grid(row=1, column=1, sticky=tk.W, padx=10)
        
        # Output directory
        ttk.Label(config_frame, text="Output directory:").grid(
            row=2, column=0, sticky=tk.W, pady=5
        )
        
        output_frame = ttk.Frame(config_frame)
        output_frame.grid(row=2, column=1, sticky=tk.W, padx=10)
        
        output_entry = ttk.Entry(output_frame, textvariable=self.output_dir_var, width=30)
        output_entry.pack(side=tk.LEFT)
        
        browse_button = ttk.Button(
            output_frame,
            text="Browse",
            command=self.browse_output_dir
        )
        browse_button.pack(side=tk.LEFT, padx=5)
        
        # Project Selection Frame
        projects_frame = ttk.LabelFrame(self.root, text="Select Projects to Evaluate", padding="10")
        projects_frame.grid(row=2, column=0, columnspan=2, sticky=(tk.W, tk.E, tk.N, tk.S), padx=10, pady=5)
        
        # Create scrollable frame for checkboxes
        canvas = tk.Canvas(projects_frame, height=200)
        scrollbar = ttk.Scrollbar(projects_frame, orient="vertical", command=canvas.yview)
        self.scrollable_frame = ttk.Frame(canvas)
        
        self.scrollable_frame.bind(
            "<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
        )
        
        canvas.create_window((0, 0), window=self.scrollable_frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)
        
        canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")
        
        # Select/Deselect all buttons
        button_frame = ttk.Frame(projects_frame)
        button_frame.pack(fill="x", pady=5)
        
        ttk.Button(
            button_frame,
            text="Select All",
            command=self.select_all_projects
        ).pack(side=tk.LEFT, padx=5)
        
        ttk.Button(
            button_frame,
            text="Deselect All",
            command=self.deselect_all_projects
        ).pack(side=tk.LEFT)
        
        # Progress Frame
        progress_frame = ttk.LabelFrame(self.root, text="Progress", padding="10")
        progress_frame.grid(row=3, column=0, columnspan=2, sticky=(tk.W, tk.E), padx=10, pady=5)
        
        self.progress_var = tk.StringVar(value="Ready to start evaluation")
        self.progress_label = ttk.Label(progress_frame, textvariable=self.progress_var)
        self.progress_label.pack(fill="x")
        
        self.progress_bar = ttk.Progressbar(progress_frame, mode='indeterminate')
        self.progress_bar.pack(fill="x", pady=5)
        
        # Log Text
        log_frame = ttk.LabelFrame(self.root, text="Log", padding="10")
        log_frame.grid(row=4, column=0, columnspan=2, sticky=(tk.W, tk.E, tk.N, tk.S), padx=10, pady=5)
        
        self.log_text = tk.Text(log_frame, height=10, wrap=tk.WORD)
        log_scrollbar = ttk.Scrollbar(log_frame, orient="vertical", command=self.log_text.yview)
        self.log_text.configure(yscrollcommand=log_scrollbar.set)
        
        self.log_text.pack(side="left", fill="both", expand=True)
        log_scrollbar.pack(side="right", fill="y")
        
        # Control Buttons
        control_frame = ttk.Frame(self.root, padding="10")
        control_frame.grid(row=5, column=0, columnspan=2, sticky=(tk.W, tk.E))
        
        self.run_button = ttk.Button(
            control_frame,
            text="Run Evaluation",
            command=self.run_evaluation,
            style="Accent.TButton"
        )
        self.run_button.pack(side=tk.LEFT, padx=5)
        
        self.stop_button = ttk.Button(
            control_frame,
            text="Stop",
            command=self.stop_evaluation,
            state=tk.DISABLED
        )
        self.stop_button.pack(side=tk.LEFT)
        
        ttk.Button(
            control_frame,
            text="Clear Log",
            command=self.clear_log
        ).pack(side=tk.LEFT, padx=20)
        
        ttk.Button(
            control_frame,
            text="Exit",
            command=self.root.quit
        ).pack(side=tk.RIGHT)
        
        # Configure grid weights
        self.root.grid_rowconfigure(2, weight=1)
        self.root.grid_rowconfigure(4, weight=1)
        self.root.grid_columnconfigure(0, weight=1)
        
    def load_projects(self):
        """Load available projects from eval-data directory."""
        eval_data_dir = Path("eval-data")
        
        if not eval_data_dir.exists():
            self.log("Error: eval-data directory not found")
            return
            
        for widget in self.scrollable_frame.winfo_children():
            widget.destroy()
            
        self.selected_projects.clear()
        
        project_dirs = [d for d in eval_data_dir.iterdir() if d.is_dir()]
        
        if not project_dirs:
            ttk.Label(
                self.scrollable_frame,
                text="No projects found in eval-data directory"
            ).pack()
            return
            
        for project_dir in sorted(project_dirs):
            var = tk.BooleanVar(value=True)
            self.selected_projects[project_dir.name] = var
            
            checkbox = ttk.Checkbutton(
                self.scrollable_frame,
                text=project_dir.name,
                variable=var
            )
            checkbox.pack(anchor=tk.W, pady=2)
            
        self.log(f"Loaded {len(project_dirs)} projects")
        
    def browse_output_dir(self):
        """Browse for output directory."""
        directory = filedialog.askdirectory()
        if directory:
            self.output_dir_var.set(directory)
            
    def select_all_projects(self):
        """Select all projects."""
        for var in self.selected_projects.values():
            var.set(True)
            
    def deselect_all_projects(self):
        """Deselect all projects."""
        for var in self.selected_projects.values():
            var.set(False)
            
    def log(self, message):
        """Add message to log."""
        timestamp = datetime.now().strftime("%H:%M:%S")
        self.log_text.insert(tk.END, f"[{timestamp}] {message}\n")
        self.log_text.see(tk.END)
        self.root.update_idletasks()
        
    def clear_log(self):
        """Clear the log text."""
        self.log_text.delete(1.0, tk.END)
        
    def run_evaluation(self):
        """Run the evaluation in a separate thread."""
        if self.is_running:
            messagebox.showwarning("Warning", "Evaluation is already running")
            return
            
        # Get selected projects
        selected = [name for name, var in self.selected_projects.items() if var.get()]
        
        if not selected:
            messagebox.showwarning("Warning", "Please select at least one project")
            return
            
        # Validate backend URL
        backend_url = self.backend_url_var.get().strip()
        if not backend_url:
            messagebox.showerror("Error", "Please enter a backend URL")
            return
            
        # Start evaluation in thread
        self.is_running = True
        self.run_button.config(state=tk.DISABLED)
        self.stop_button.config(state=tk.NORMAL)
        self.progress_bar.start()
        
        thread = threading.Thread(
            target=self.run_evaluation_thread,
            args=(selected, backend_url),
            daemon=True
        )
        thread.start()
        
    def run_evaluation_thread(self, selected_projects, backend_url):
        """Run evaluation in separate thread."""
        try:
            # Create new event loop for thread
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            # Run async evaluation
            loop.run_until_complete(
                self.run_evaluation_async(selected_projects, backend_url)
            )
            
        except Exception as e:
            self.log(f"Error: {str(e)}")
            messagebox.showerror("Error", f"Evaluation failed: {str(e)}")
            
        finally:
            self.is_running = False
            self.root.after(0, self.evaluation_complete)
            
    async def run_evaluation_async(self, selected_projects, backend_url):
        """Async evaluation logic."""
        # Create output directory
        output_dir = Path(self.output_dir_var.get())
        output_dir.mkdir(exist_ok=True)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        run_output_dir = output_dir / f"run_{timestamp}"
        run_output_dir.mkdir(exist_ok=True)
        
        self.log(f"Starting evaluation...")
        self.log(f"Output directory: {run_output_dir}")
        
        num_students = self.num_students_var.get()
        
        # Run evaluations
        async with BackendClient(backend_url) as client:
            for project_name in selected_projects:
                if not self.is_running:
                    self.log("Evaluation stopped by user")
                    break
                    
                project_path = Path("eval-data") / project_name
                
                self.root.after(
                    0,
                    lambda p=project_name: self.progress_var.set(f"Evaluating {p}...")
                )
                
                await evaluate_project(
                    project_path=project_path,
                    backend_client=client,
                    num_students=num_students,
                    output_dir=run_output_dir
                )
                
                self.log(f"Completed: {project_name}")
                
        if self.is_running:
            # Create summary report
            self.log("Creating summary report...")
            create_summary_report(run_output_dir)
            
            self.log(f"Evaluation complete! Results saved to: {run_output_dir}")
            
            # Open output directory
            if os.name == 'nt':  # Windows
                os.startfile(run_output_dir)
            elif os.name == 'posix':  # macOS and Linux
                os.system(f'open "{run_output_dir}"')
                
    def stop_evaluation(self):
        """Stop the evaluation."""
        self.is_running = False
        self.log("Stopping evaluation...")
        
    def evaluation_complete(self):
        """Called when evaluation is complete."""
        self.run_button.config(state=tk.NORMAL)
        self.stop_button.config(state=tk.DISABLED)
        self.progress_bar.stop()
        self.progress_var.set("Evaluation complete")


def main():
    """Main entry point."""
    root = tk.Tk()
    
    # Set style
    style = ttk.Style()
    style.theme_use('clam')
    
    # Configure accent button style
    style.configure(
        "Accent.TButton",
        background="#0078D4",
        foreground="white",
        borderwidth=0,
        focuscolor="none"
    )
    style.map(
        "Accent.TButton",
        background=[('active', '#106EBE'), ('pressed', '#005A9E')]
    )
    
    app = EvaluationGUI(root)
    root.mainloop()


if __name__ == "__main__":
    main() 