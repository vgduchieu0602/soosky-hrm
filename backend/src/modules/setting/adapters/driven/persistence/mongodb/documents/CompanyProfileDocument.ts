/** Dạng document lưu trữ của aggregate `CompanyProfile` (singleton, `_id` cố định). */
export default interface CompanyProfileDocument {
    _id:                       string;
    name:                      string;
    address:                   string | null;
    taxCode:                   string | null;
    phone:                     string | null;
    email:                     string | null;
    logoUrl:                   string | null;
    timezone:                  string;
    currency:                  string;
    standardWorkHoursPerDay:   number;
    standardWorkDaysPerMonth:  number;
    createdAt:                 Date;
    updatedAt:                 Date;
}
