import React from "react";
import './Footer.css';

const Footer = () => {
    return(
        <div className="footer-component-container">
            <footer>
                <p>© Copyright <b>Techstar Group.</b> All Rights Reserved</p>
                <ul>
                    <li>Privacy Policy</li>
                    <li>Terms of Service</li>
                    <li>Support</li>
                </ul>
            </footer>
        </div>
    );
}

export default Footer;