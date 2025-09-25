import { useState } from "react";
import "./SuperAdmin.css";
import Footer from "../Layout/Footer";

const SuperAdmin = () => {
  const [showPopup, setShowPopup] = useState(false);
  const [plan, setPlan] = useState("");
  const [aiModelOne, setAiModelOne] = useState("");
  const [aiModelTwo, setAiModelTwo] = useState("");
  const [formData, setFormData] = useState({
    companyName: "",
    email: "",
    address: "",
  });

  const aiOptions = ["Invoice", "Bank Statement", "Mortgage"];

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleClear = () => {
    setFormData({ companyName: "", email: "", address: "" });
    setPlan("");
    setAiModelOne("");
    setAiModelTwo("");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Form Submitted:", { ...formData, plan, aiModelOne, aiModelTwo });
    setShowPopup(false);
    handleClear();
  };

  return (
    <div className="superAdmin-container">
      <main className="superAdmin-main">
        {/* Stats Box */}
        <div className="superAdmin-stats-box">
          <ul>
            <li>
              <p>Total Docs</p>
              <p>1,000</p>
            </li>
            <li>
              <p>Avg Docs / Day</p>
              <p>2,000</p>
            </li>
            <li>
              <p>No. of Users</p>
              <p>3,000</p>
            </li>
          </ul>
        </div>

        {/* Clients Table */}
        <div className="superAdmin-add-table">
          <div className="superAdmin-add-clients">
            <h3>Client Management</h3>
            <button onClick={() => setShowPopup(true)}>Add Client</button>
          </div>
          <div className="superAdmin-table-box">
            <table>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Plan</th>
                  <th>Users</th>
                  <th>Docs</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>--</td>
                  <td>--</td>
                  <td>--</td>
                  <td>--</td>
                  <td><button>View</button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Popup Form */}
      {showPopup && (
        <div className="popup-overlay">
          <div className="popup-form">
            <h2>Add Client</h2>
            <form onSubmit={handleSubmit}>
              {/* Subscription Plan */}
              <label>Subscription Plan:</label>
              <select value={plan} onChange={(e) => setPlan(e.target.value)} required>
                <option value="">Select Plan</option>
                <option value="Pro">Pro (Starter)</option>
                <option value="Pro+">Pro+ (Advanced)</option>
                <option value="Premium">Premium (Enterprise)</option>
              </select>

              {/* AI Models */}
              {plan === "Pro" && (
                <>
                  <label>AI Model:</label>
                  <select value={aiModelOne} onChange={(e) => setAiModelOne(e.target.value)} required>
                    <option value="">Select Model</option>
                    {aiOptions.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </>
              )}

              {plan === "Pro+" && (
                <>
                  <label>AI Model One:</label>
                  <select value={aiModelOne} onChange={(e) => setAiModelOne(e.target.value)} required>
                    <option value="">Select Model</option>
                    {aiOptions
                      .filter((opt) => opt !== aiModelTwo)
                      .map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                  </select>

                  <label>AI Model Two:</label>
                  <select value={aiModelTwo} onChange={(e) => setAiModelTwo(e.target.value)} required>
                    <option value="">Select Model</option>
                    {aiOptions
                      .filter((opt) => opt !== aiModelOne)
                      .map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                  </select>
                </>
              )}

              {plan === "Premium" && (
                <div className="premium-models">
                  <p>AI Models: Invoice, Bank Statement, Mortgage (Pre-selected)</p>
                </div>
              )}

              {/* Client Details */}
              <label>Company Name:</label>
              <input
                type="text"
                name="companyName"
                value={formData.companyName}
                onChange={handleInputChange}
                required
              />

              <label>Email:</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
              />

              <label>Company Address:</label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                required
              />

              {/* Actions */}
              <div className="form-actions">
                <button type="submit">Submit</button>
                <button type="button" onClick={handleClear}>Clear</button>
                <button type="button" onClick={() => setShowPopup(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <footer>
        <Footer />
      </footer>
    </div>
  );
};

export default SuperAdmin;
