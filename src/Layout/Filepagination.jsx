import React from 'react';
import PropTypes from 'prop-types';
import './Filepagination.css'
const FilePagination = ({
  currentPage,
  totalPages,
  onPageChange,
  rowsPerPage,
  totalItems,
  previousLabel = 'Back',
  nextLabel = 'Next',
  className = '',
}) => {
  if (totalPages <= 1) return null;

  // Generate page numbers with ellipsis logic
  const getPageNumbers = () => {
    const pages = [];
    const leftBound = Math.max(2, currentPage - 1);
    const rightBound = Math.min(totalPages - 1, currentPage + 1);

    // Always add first page
    pages.push(1);

    // Add left ellipsis if needed
    if (leftBound > 2) {
      pages.push('...');
    }

    // Add middle pages
    for (let i = leftBound; i <= rightBound; i++) {
      if (i > 1 && i < totalPages) {
        pages.push(i);
      }
    }

    // Add right ellipsis if needed
    if (rightBound < totalPages - 1) {
      pages.push('...');
    }

    // Always add last page if different from first
    if (totalPages > 1) {
      pages.push(totalPages);
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
  <div className={`pagination-container ${className}`}>
    <div className="pagination">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="pagination-button"
      >
        {previousLabel}
      </button>

      {pageNumbers.map((page, index) => (
        <React.Fragment key={index}>
          {page === '...' ? (
            <span className="pagination-ellipsis">...</span>
          ) : (
            <button
              onClick={() => onPageChange(page)}
              disabled={page === currentPage}
              className={`pagination-button ${page === currentPage ? 'active' : ''}`}
            >
              {page}
            </button>
          )}
        </React.Fragment>
      ))}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="pagination-button"
      >
        {nextLabel}
      </button>
    </div>

    {rowsPerPage && totalItems && (
      <div className="pagination-count">
        Showing {(currentPage - 1) * rowsPerPage + 1}-
        {Math.min(currentPage * rowsPerPage, totalItems)} of {totalItems} items
      </div>
    )}
  </div>
);

};

FilePagination.propTypes = {
  currentPage: PropTypes.number.isRequired,
  totalPages: PropTypes.number.isRequired,
  onPageChange: PropTypes.func.isRequired,
  rowsPerPage: PropTypes.number,
  totalItems: PropTypes.number,
  previousLabel: PropTypes.string,
  nextLabel: PropTypes.string,
  className: PropTypes.string,
};

export default FilePagination;