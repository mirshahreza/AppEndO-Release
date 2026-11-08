/**
 * Remove the Studio CMS nav group left behind after package uninstall.
 */
import { removeCmsStudioNavGroup } from './cmsStudioNav';

const removed = removeCmsStudioNavGroup();
console.log(removed ? 'Removed leftover CMS Studio nav group.' : 'No CMS Studio nav group to remove.');
