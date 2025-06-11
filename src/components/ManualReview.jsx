import React from 'react';
import './ManualReview.css';
import Footer from '../Layout/Footer';

const ManualReview = () => {
    return (
        <div className='manual-review-container-all'>
            <div className='manual-review-container'>
                <div className='manual-review-header-container'>
                    <h1>Manual Review</h1>
                </div>
                <div className='filter-for-manual-review'>
                    <h1>Filter</h1>
                </div>
                <table className='filter-for-manual-review'>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Status</th>
                            <th>Uploaded</th>
                            <th>Date</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Sample Name</td>
                            <td>Pending</td>
                            <td>file.pdf</td>
                            <td>2025-06-10</td>
                            <td>Review</td>
                        </tr>
                        <tr>
                            <td>Sample Name</td>
                            <td>Pending</td>
                            <td>file.pdf</td>
                            <td>2025-06-10</td>
                            <td>Review</td>
                        </tr>
                        <tr>
                            <td>Sample Name</td>
                            <td>Pending</td>
                            <td>file.pdf</td>
                            <td>2025-06-10</td>
                            <td>Review</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <footer>
                <Footer />
            </footer>
        </div>
    );
};

export default ManualReview;
