export const BUSINESS_UNITS = [
  { key: "all", label: "CEO Dashboard" },
  { key: "ecom_pos", label: "Ecom / POS / Website Sales" },
  { key: "urbanfit", label: "UrbanFit Tailor Shop" },
  { key: "school_saas", label: "School Management SaaS" },
  { key: "physical_school", label: "Physical School" },
  { key: "it_courses", label: "IT Courses Training" },
  { key: "office_general", label: "Office & General Expenses" }
];

export const PANEL_FIELDS = {
  ecom_pos: {
    title: "Ecom / POS / Website Sales",
    revenue: ["Project revenue", "SaaS subscriptions", "Hosting renewals", "Client payments"],
    expense: ["Sales person commission", "Development cost", "Marketing cost"],
    features: ["Invoice tracking", "Client ledger", "Revenue vs cost analysis", "Profit per project"]
  },
  urbanfit: {
    title: "UrbanFit (Physical Tailor Shop)",
    revenue: ["Daily sales", "Stitching orders", "Advance payments", "Remaining payments"],
    expense: ["Fabric costs", "Tailor salaries", "Shop rent & utilities"],
    features: ["Daily POS entry", "Order tracking", "Monthly profit calculation"]
  },
  school_saas: {
    title: "School Management System (SaaS)",
    revenue: ["Subscription revenue", "Plan-wise revenue"],
    expense: ["Server cost", "Development cost", "Support team cost"],
    features: ["MRR", "SaaS profit margin", "Churn tracking (optional advanced)"]
  },
  physical_school: {
    title: "Physical School",
    revenue: ["Student fee collection", "Pending fees"],
    expense: ["Teacher salaries", "Utility bills", "Event expenses", "Books & material cost"],
    features: ["Fee defaulter list", "Monthly income report", "Expense per student calculation"]
  },
  it_courses: {
    title: "IT Courses Training",
    revenue: ["Student enrollments", "Course-wise revenue"],
    expense: ["Trainer salaries", "Marketing cost", "Certificate cost", "Refunds"],
    features: ["Batch tracking", "Course profitability", "Trainer performance"]
  },
  office_general: {
    title: "Office & General Expenses",
    revenue: ["Internal transfers"],
    expense: ["Office rent", "Internet", "Electricity", "Software subscriptions", "Salaries", "Equipment purchases"],
    features: ["Categorized expense tracking", "Monthly operating cost summary"]
  }
};